-- Phase 1: immutable public player profiles and an auditable Elo match ledger.
-- Apply through Supabase CLI/dashboard only; clients receive read-only access.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_]{3,20}$'),
  elo integer not null default 0 check (elo >= 0),
  last_played_at timestamptz,
  created_at timestamptz not null default now()
);

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_username text;
begin
  new_username := lower(trim(coalesce(new.raw_user_meta_data ->> 'username', '')));
  if new_username !~ '^[a-z0-9_]{3,20}$' then
    raise exception 'A valid immutable username is required.';
  end if;

  insert into public.profiles (id, username)
  values (new.id, new_username);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute procedure public.create_profile_for_new_user();

-- Backfill existing authenticated accounts created before this migration.
insert into public.profiles (id, username)
select id, lower(trim(raw_user_meta_data ->> 'username'))
from auth.users
where lower(trim(coalesce(raw_user_meta_data ->> 'username', ''))) ~ '^[a-z0-9_]{3,20}$'
on conflict (id) do nothing;

alter table public.profiles enable row level security;

create policy "public profiles are readable"
  on public.profiles
  for select
  using (true);

create table if not exists public.elo_matches (
  id uuid primary key,
  room_code text not null check (room_code ~ '^[A-Z0-9]{8}$'),
  submitted_by uuid not null references public.profiles(id),
  status text not null check (status in ('finalized', 'unrated')),
  completed_at timestamptz not null default now(),
  rating_applied_at timestamptz unique
);

create table if not exists public.elo_match_participants (
  match_id uuid not null references public.elo_matches(id) on delete cascade,
  profile_id uuid not null references public.profiles(id),
  placement integer not null check (placement >= 1),
  score integer not null check (score >= 0),
  answered integer not null check (answered >= 0),
  elapsed_seconds integer not null check (elapsed_seconds >= 0),
  elo_before integer not null check (elo_before >= 0),
  elo_change integer not null,
  elo_after integer not null check (elo_after >= 0),
  primary key (match_id, profile_id)
);

create index if not exists profiles_leaderboard_order
  on public.profiles (elo desc, username asc);
create index if not exists profiles_last_played_order
  on public.profiles (last_played_at desc nulls last);
create index if not exists elo_match_participants_profile_id
  on public.elo_match_participants (profile_id, match_id);

alter table public.elo_matches enable row level security;
alter table public.elo_match_participants enable row level security;

-- No browser-client write policy is intentionally created for Elo tables.
-- Phase 2 will add a SECURITY DEFINER RPC/Edge Function that finalizes an
-- eligible casual match atomically and is the only supported writer.
