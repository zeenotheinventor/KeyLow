-- palate_logged_days: how many days the diary has anything logged in the palate window (KEY-1023).
-- Core needs it to say how often a food comes up ("most days") and to know when there is too little to
-- go on. `palate_food_stats` cannot give it, because a day with only a quick entry names no food.
--
-- The window is the one of `palate_food_stats`: the entry's `local_date` from 89 days before the
-- owner's local today in `profiles.timezone` up to today, which is 90 days counting today. Entries
-- that are soft deleted do not count, and a quick entry does. The view runs with the caller's rights,
-- so the policies of `food_log_entries` and `profiles` apply. It has one row per owner with at least
-- one logged day and none for an owner with nothing logged, so a reader treats no row as 0. The view
-- does arithmetic only.
create view public.palate_logged_days
with (security_invoker = true)
as
select
  entry.user_id as owner_id,
  count(distinct entry.local_date)::integer as logged_days
from public.food_log_entries entry
join public.profiles profile on profile.id = entry.user_id
where entry.deleted_at is null
  and entry.local_date > (now() at time zone profile.timezone)::date - 90
  and entry.local_date <= (now() at time zone profile.timezone)::date
group by entry.user_id;

revoke all on public.palate_logged_days from anon, authenticated, service_role;
grant select on public.palate_logged_days to authenticated;
