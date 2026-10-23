-- Six weeks (42 days) of body fat and lean mass readings for the demo user
-- (11111111-1111-4111-8111-111111111111), so the body composition screens have a trend to draw on a
-- fresh stack. Hand written, never loaded into production (deploy-supabase.yml runs db push without
-- --include-seed). KEY-569, Amendment 11 of ADR 0003.
--
-- Every figure is a function of the day count, so the file is deterministic (no random()), and every
-- row has a fixed id, so loading it again moves the same rows to today and adds none. Dates are
-- relative to today in the demo profile's time zone, which is also the zone stored in `tz`.
--
-- What the data holds:
--   * body fat drifting from about 22.8 per cent, 41 days ago, to about 22.0 today, and lean mass
--     from about 65.6 kg to about 65.2 kg, both with a small repeatable wobble
--   * readings on about two days in three, as a scale used most mornings gives, with body fat and
--     lean mass on the same days, as a smart scale writes them
--   * a gap of five days with no reading (12 to 16 days ago)
--   * one day (20 days ago) with two body fat readings, so the median case has data
--   * every reading imported from Health Connect, with an external id of seed-hc-bf-<n> or
--     seed-hc-lm-<n>
--   * one soft-deleted body fat import (external id seed-hc-bf-deleted), which proves that a deleted
--     import is skipped by the next import
--   * eight readings of each kind in the last 14 days, so the demo user is settled (seven are
--     needed). The settling state belongs to a brand-new account and not to this user.
--
-- test/integration/database/body-measurements-seed.test.ts asserts these facts about the demo user's
-- rows.

begin;

do $$
begin
  if not exists (
    select 1 from public.profiles where id = '11111111-1111-4111-8111-111111111111'
  ) then
    raise exception 'seed expected the demo profile row, created by seed.sql';
  end if;
end;
$$;

with demo as (
  select id, timezone as tz, (now() at time zone timezone)::date as today
  from public.profiles
  where id = '11111111-1111-4111-8111-111111111111'
),
days as (
  -- Every day of the window except the gap, and except one day in three (the days whose number
  -- leaves a remainder of 1 when divided by 3), which leaves readings on about two days in three.
  select
    days_ago,
    time '07:30' + ((days_ago + 1) % 4) * interval '5 minutes' as local_time
  from generate_series(0, 41) as days_ago
  where days_ago not between 12 and 16
    and days_ago % 3 <> 1
),
readings as (
  -- Body fat. The row number is days ago plus one.
  select
    days_ago + 1 as n,
    'body_fat_pct' as kind,
    days_ago,
    local_time,
    round((22.0 + 0.8 * days_ago / 41.0 + ((((days_ago * 7 + 3) % 5) - 2) * 0.05))::numeric, 1) as value,
    'seed-hc-bf-' || (days_ago + 1) as external_id,
    false as is_deleted
  from days

  union all

  -- Lean mass, on the same days. Its ids start at 1000 so they never meet a body fat id.
  select
    1000 + days_ago + 1,
    'lean_mass_kg',
    days_ago,
    local_time,
    round((65.2 + 0.4 * days_ago / 41.0 + ((((days_ago * 3 + 1) % 5) - 2) * 0.05))::numeric, 2),
    'seed-hc-lm-' || (days_ago + 1),
    false
  from days

  union all

  -- The second body fat reading of the day 20 days ago, in the evening.
  select 101, 'body_fat_pct', 20, time '19:30', 22.5::numeric, 'seed-hc-bf-101', false

  union all

  -- An imported body fat reading the user deleted. It keeps its import key, so the next import
  -- skips it.
  select 102, 'body_fat_pct', 30, time '07:45', 22.6::numeric, 'seed-hc-bf-deleted', true
)
insert into public.body_measurements (id, user_id, kind, measured_at, local_date, tz, value, source, external_id, deleted_at)
select
  ('5eed0041-0000-4000-8000-' || lpad(readings.n::text, 12, '0'))::uuid,
  demo.id,
  readings.kind::public.body_measurement_kind,
  -- A reading is never in the future, so a stack seeded early in the morning stays plausible.
  least(((demo.today - readings.days_ago) + readings.local_time) at time zone demo.tz, now()),
  demo.today - readings.days_ago,
  demo.tz,
  readings.value,
  'health_connect',
  readings.external_id,
  case when readings.is_deleted then now() end
from demo
cross join readings
on conflict (id) do update set
  kind = excluded.kind,
  measured_at = excluded.measured_at,
  local_date = excluded.local_date,
  tz = excluded.tz,
  value = excluded.value,
  source = excluded.source,
  external_id = excluded.external_id,
  deleted_at = excluded.deleted_at;

commit;
