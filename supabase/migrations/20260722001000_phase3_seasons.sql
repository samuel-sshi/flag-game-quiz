-- Phase 3: monthly WIB seasons and 12-month historical Elo snapshots.

create table if not exists public.elo_seasons (
  id uuid primary key default gen_random_uuid(),
  starts_at timestamptz not null unique,
  ends_at timestamptz not null unique,
  status text not null check (status in ('active', 'closed')),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table if not exists public.elo_season_profiles (
  season_id uuid not null references public.elo_seasons(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  username text not null,
  elo integer not null check (elo >= 0),
  games_played integer not null check (games_played >= 0),
  last_played_at timestamptz,
  primary key (season_id, profile_id)
);

create index if not exists elo_season_profiles_leaderboard_order
  on public.elo_season_profiles (season_id, elo desc, games_played desc, username asc);

create or replace function public.ensure_current_elo_season()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start timestamptz := date_trunc('month', now() at time zone 'Asia/Jakarta') at time zone 'Asia/Jakarta';
  v_end timestamptz := (date_trunc('month', now() at time zone 'Asia/Jakarta') + interval '1 month') at time zone 'Asia/Jakarta';
  v_id uuid;
begin
  insert into public.elo_seasons (starts_at, ends_at, status)
  values (v_start, v_end, 'active')
  on conflict (starts_at) do update set status = 'active'
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.rollover_elo_season()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old public.elo_seasons%rowtype;
  v_new uuid;
begin
  select * into v_old from public.elo_seasons where status = 'active' and ends_at <= now() order by ends_at desc limit 1 for update;
  if found then
    insert into public.elo_season_profiles (season_id, profile_id, username, elo, games_played, last_played_at)
    select v_old.id, id, username, elo, games_played, last_played_at from public.profiles
    on conflict (season_id, profile_id) do nothing;
    update public.profiles set elo = floor(elo / 2.0)::integer, games_played = 0, last_played_at = null;
    update public.elo_seasons set status = 'closed' where id = v_old.id;
  end if;
  v_new := public.ensure_current_elo_season();
  delete from public.elo_seasons where status = 'closed' and ends_at < now() - interval '12 months';
  return v_new;
end;
$$;

select public.ensure_current_elo_season();

grant execute on function public.rollover_elo_season() to service_role;
