-- Phase 2 slice: public paginated leaderboard with shared rank.
-- Players tied on Elo share rank; within that rank, players with more rated
-- games are listed first, then usernames alphabetically for stable pagination.

alter table public.profiles
  add column if not exists games_played integer not null default 0 check (games_played >= 0);

create index if not exists profiles_public_leaderboard_order
  on public.profiles (elo desc, games_played desc, username asc);

create or replace function public.get_elo_leaderboard(
  p_page integer default 1,
  p_page_size integer default 25
)
returns table (
  rank bigint,
  username text,
  elo integer,
  games_played integer,
  last_played_at timestamptz,
  total_players bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with safe_page as (
    select greatest(1, coalesce(p_page, 1)) as page,
           least(100, greatest(1, coalesce(p_page_size, 25))) as page_size
  ), ranked as (
    select
      rank() over (order by p.elo desc) as rank,
      p.username,
      p.elo,
      p.games_played,
      p.last_played_at,
      count(*) over () as total_players
    from public.profiles p
  )
  select r.rank, r.username, r.elo, r.games_played, r.last_played_at, r.total_players
  from ranked r cross join safe_page s
  order by r.elo desc, r.games_played desc, r.username asc
  limit (select page_size from safe_page)
  offset ((select page from safe_page) - 1) * (select page_size from safe_page);
$$;

grant execute on function public.get_elo_leaderboard(integer, integer) to anon, authenticated;
