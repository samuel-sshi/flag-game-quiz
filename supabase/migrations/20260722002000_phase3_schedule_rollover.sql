-- Run at 00:00 WIB without relying on the database cron timezone.
-- pg_cron uses UTC: 17:00 UTC is 00:00 Asia/Jakarta. It runs on days 28-31
-- and the guard executes the rollover only when local time is the first day.

create extension if not exists pg_cron;

create or replace function public.run_monthly_elo_rollover()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_local timestamp := now() at time zone 'Asia/Jakarta';
begin
  if extract(day from v_local) = 1 and extract(hour from v_local) = 0 then
    perform public.rollover_elo_season();
  end if;
end;
$$;

do $$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id from cron.job where jobname = 'monthly-elo-rollover' limit 1;
  if v_job_id is not null then perform cron.unschedule(v_job_id); end if;
  perform cron.schedule('monthly-elo-rollover', '0 17 28-31 * *', 'select public.run_monthly_elo_rollover();');
end;
$$;
