-- Six weeks (42 days) of weigh-ins for the demo user (11111111-1111-4111-8111-111111111111), so the
-- weight screen has a trend to draw on a fresh stack. Hand written, never loaded into production
-- (deploy-supabase.yml runs db push without --include-seed). KEY-360, Amendment 9 of ADR 0003.
--
-- Every figure is a function of the day count, so the file is deterministic (no random()), and every
-- row has a fixed id, so loading it again moves the same rows to today and adds none. Dates are
-- relative to today in the demo profile's time zone, which is also the zone stored in `tz`.
--
-- What the data holds:
--   * a downward drift from 85.0 kg, 41 days ago, to 83.6 kg today, with a small repeatable
--     wobble of up to 0.2 kg either way
--   * a gap of five days with no weigh-in (12 to 16 days ago)
--   * a spike of 99.0 kg 6 days ago, which computeTrend rejects: it is more than 15 per cent above
--     the trend and disagrees with the reading after it
--   * one day (20 days ago) with two readings, so the median case has data
--   * about one reading in three imported from Health Connect (external id seed-hc-<n>), the rest
--     manual
--   * one soft-deleted imported row (external id seed-hc-deleted), which proves that a deleted
--     import is skipped by the next import
--   * eleven accepted readings in the last 14 days, so the demo user is settled (seven are needed).
--     The settling state belongs to a brand-new account and not to this user.
--
-- test/integration/database/weigh-ins-seed.test.ts asserts these facts about the demo user's rows.

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
readings as (
  -- One reading a day for 42 days, except the gap. The row number is days ago plus one, and every
  -- third one is imported.
  select
    days_ago + 1 as n,
    days_ago,
    time '07:30' + ((days_ago + 1) % 4) * interval '5 minutes' as local_time,
    case
      when days_ago = 6 then 99.0
      else 83.6 + 1.4 * days_ago / 41.0 + ((((days_ago * 7 + 3) % 5) - 2) * 0.1)
    end as raw_weight_kg,
    case when (days_ago + 1) % 3 = 0 then 'health_connect' else 'manual' end as source,
    case when (days_ago + 1) % 3 = 0 then 'seed-hc-' || (days_ago + 1) end as external_id,
    false as is_deleted
  from generate_series(0, 41) as days_ago
  where days_ago not between 12 and 16

  union all

  -- The second reading of the day 20 days ago, in the evening.
  select 101, 20, time '19:30', 83.6 + 1.4 * 20 / 41.0 + 0.4, 'manual', null, false

  union all

  -- An imported reading the user deleted. It keeps its import key, so the next import skips it.
  select 102, 30, time '07:45', 84.5, 'health_connect', 'seed-hc-deleted', true
)
insert into public.weigh_ins (id, user_id, measured_at, local_date, tz, weight_kg, source, external_id, deleted_at)
select
  ('5eed0040-0000-4000-8000-' || lpad(readings.n::text, 12, '0'))::uuid,
  demo.id,
  -- A reading is never in the future, so a stack seeded early in the morning stays plausible.
  least(((demo.today - readings.days_ago) + readings.local_time) at time zone demo.tz, now()),
  demo.today - readings.days_ago,
  demo.tz,
  -- A manual weight is typed to one decimal. An imported one comes from a scale to two.
  case
    when readings.source = 'manual' then round(readings.raw_weight_kg::numeric, 1)
    else round(readings.raw_weight_kg::numeric, 2)
  end,
  readings.source::public.weigh_in_source,
  readings.external_id,
  case when readings.is_deleted then now() end
from demo
cross join readings
on conflict (id) do update set
  measured_at = excluded.measured_at,
  local_date = excluded.local_date,
  tz = excluded.tz,
  weight_kg = excluded.weight_kg,
  source = excluded.source,
  external_id = excluded.external_id,
  deleted_at = excluded.deleted_at;

commit;
