-- Asserts the public.day_totals view (ADR 0003 and Amendment 5): one row per
-- user per local day, summing the live entries' nutrients, skipping a null
-- nutrient in the sum (null, not 0, only when every entry leaves it null),
-- leaving soft deleted entries out, grouping by local_date and not by
-- logged_at, and showing a user only their own days through security_invoker.
--
-- `supabase test db` runs this file as postgres inside a transaction that is
-- rolled back, so nothing created here persists. Every fixture id starts with
-- 18200000 and every email and snapshot label with key182-. Each actor is
-- entered with `set local role` plus the JWT claims that `auth.uid()` reads,
-- and left with `reset role`.

begin;

select plan(37);

-- Two users. The on_auth_user_created trigger creates their profiles rows.
insert into auth.users (instance_id, id, aud, role, email) values
  ('00000000-0000-0000-0000-000000000000', '18200000-0000-4000-8000-00000000000a', 'authenticated', 'authenticated', 'key182-totals-a@keylow.test'),
  ('00000000-0000-0000-0000-000000000000', '18200000-0000-4000-8000-00000000000b', 'authenticated', 'authenticated', 'key182-totals-b@keylow.test');

-- Fixtures, inserted as postgres so row level security does not apply. Quick
-- entries carry no food, so no food fixture is needed.
--
-- User A, 2026-10-15: two live entries and one soft deleted one.
--   * the first knows protein and fat, leaves fibre null, has sat_fat_g and
--     sugars_g, and has no salt_g key;
--   * the second leaves protein null, has fat, leaves fibre null, has salt_g,
--     and has no sat_fat_g or sugars_g key;
--   * the third is soft deleted and would move every total if it counted.
-- User A, 2026-10-14: one live entry with every nutrient null.
-- User A, 2026-10-13: only a soft deleted entry.
-- User A, 2026-10-16: two entries whose logged_at fall on different UTC days
--   (23:30 on the 15th and 00:30 on the 17th) but whose local_date is the 16th,
--   so the day groups by local_date and not by logged_at.
-- User B, 2026-10-15: one entry, kcal 5000.
insert into public.food_log_entries (id, user_id, local_date, logged_at, item_type, snapshot, nutrients, deleted_at) values
  ('18200000-0000-4000-8000-0000000003a1', '18200000-0000-4000-8000-00000000000a', '2026-10-15', '2026-10-15 08:00:00+00', 'quick', '{"kind":"quick","label":"key182-a-1"}',
    '{"kcal":100,"protein_g":10,"fat_g":5,"carbs_g":20,"fibre_g":null,"sat_fat_g":2,"sugars_g":3}', null),
  ('18200000-0000-4000-8000-0000000003a2', '18200000-0000-4000-8000-00000000000a', '2026-10-15', '2026-10-15 12:00:00+00', 'quick', '{"kind":"quick","label":"key182-a-2"}',
    '{"kcal":250,"protein_g":null,"fat_g":7,"carbs_g":30,"fibre_g":null,"salt_g":1.5}', null),
  ('18200000-0000-4000-8000-0000000003a3', '18200000-0000-4000-8000-00000000000a', '2026-10-15', '2026-10-15 18:00:00+00', 'quick', '{"kind":"quick","label":"key182-a-deleted"}',
    '{"kcal":9000,"protein_g":900,"fat_g":900,"carbs_g":900,"fibre_g":900,"sat_fat_g":900,"sugars_g":900,"salt_g":900}', '2026-10-15 18:05:00+00'),
  ('18200000-0000-4000-8000-0000000003a4', '18200000-0000-4000-8000-00000000000a', '2026-10-14', '2026-10-14 09:00:00+00', 'quick', '{"kind":"quick","label":"key182-a-unknown"}',
    '{"kcal":null,"protein_g":null,"fat_g":null,"carbs_g":null,"fibre_g":null}', null),
  ('18200000-0000-4000-8000-0000000003a5', '18200000-0000-4000-8000-00000000000a', '2026-10-13', '2026-10-13 09:00:00+00', 'quick', '{"kind":"quick","label":"key182-a-only-deleted"}',
    '{"kcal":400,"protein_g":1,"fat_g":1,"carbs_g":1,"fibre_g":1}', '2026-10-13 09:05:00+00'),
  ('18200000-0000-4000-8000-0000000003a6', '18200000-0000-4000-8000-00000000000a', '2026-10-16', '2026-10-15 23:30:00+00', 'quick', '{"kind":"quick","label":"key182-a-late"}',
    '{"kcal":10,"protein_g":1,"fat_g":1,"carbs_g":1,"fibre_g":1}', null),
  ('18200000-0000-4000-8000-0000000003a7', '18200000-0000-4000-8000-00000000000a', '2026-10-16', '2026-10-17 00:30:00+00', 'quick', '{"kind":"quick","label":"key182-a-early"}',
    '{"kcal":20,"protein_g":2,"fat_g":2,"carbs_g":2,"fibre_g":2}', null),
  ('18200000-0000-4000-8000-0000000003b1', '18200000-0000-4000-8000-00000000000b', '2026-10-15', '2026-10-15 10:00:00+00', 'quick', '{"kind":"quick","label":"key182-b-1"}',
    '{"kcal":5000,"protein_g":500,"fat_g":500,"carbs_g":500,"fibre_g":500}', null);

-- Shape: a view, with the frozen key, the eight nutrients and the entry count.
select has_view('public', 'day_totals', 'day_totals is a view');
select columns_are(
  'public',
  'day_totals',
  array['user_id', 'local_date', 'kcal', 'protein_g', 'fat_g', 'carbs_g', 'fibre_g', 'sat_fat_g', 'sugars_g', 'salt_g', 'entry_count'],
  'day_totals has the user, the day, the eight nutrient sums and the entry count'
);
select ok(
  (select coalesce(reloptions @> array['security_invoker=true'], false) from pg_class where oid = 'public.day_totals'::regclass),
  'day_totals is a security_invoker view'
);

-- Privileges, read from the catalog.
select ok(
  not has_table_privilege('anon', 'public.day_totals', 'select')
    and not has_table_privilege('anon', 'public.day_totals', 'insert')
    and not has_table_privilege('anon', 'public.day_totals', 'update')
    and not has_table_privilege('anon', 'public.day_totals', 'delete'),
  'anon has no privilege on day_totals'
);
select ok(
  has_table_privilege('authenticated', 'public.day_totals', 'select')
    and not has_table_privilege('authenticated', 'public.day_totals', 'insert')
    and not has_table_privilege('authenticated', 'public.day_totals', 'update')
    and not has_table_privilege('authenticated', 'public.day_totals', 'delete'),
  'authenticated can only select from day_totals'
);

select ok(
  not exists (
    select 1
    from pg_class as view_class, aclexplode(view_class.relacl) as privilege
    where view_class.oid = 'public.day_totals'::regclass
      and privilege.grantee = 'service_role'::regrole
  ),
  'service_role holds no privilege of any kind on day_totals, not even the default truncate or references'
);

-- A non-number optional nutrient would break the view's cast to numeric, so the
-- entries CHECK rejects it on insert and on update.
select throws_ok(
  $$insert into public.food_log_entries (user_id, local_date, item_type, snapshot, nutrients) values ('18200000-0000-4000-8000-00000000000a', '2026-10-18', 'quick', '{"kind":"quick"}', '{"kcal":1,"protein_g":1,"fat_g":1,"carbs_g":1,"fibre_g":1,"salt_g":"abc"}')$$,
  '23514',
  'new row for relation "food_log_entries" violates check constraint "food_log_entries_nutrients_required_keys"',
  'a string salt_g is rejected'
);
select throws_ok(
  $$insert into public.food_log_entries (user_id, local_date, item_type, snapshot, nutrients) values ('18200000-0000-4000-8000-00000000000a', '2026-10-18', 'quick', '{"kind":"quick"}', '{"kcal":1,"protein_g":1,"fat_g":1,"carbs_g":1,"fibre_g":1,"sat_fat_g":{"a":1}}')$$,
  '23514',
  'new row for relation "food_log_entries" violates check constraint "food_log_entries_nutrients_required_keys"',
  'an object sat_fat_g is rejected'
);
select throws_ok(
  $$insert into public.food_log_entries (user_id, local_date, item_type, snapshot, nutrients) values ('18200000-0000-4000-8000-00000000000a', '2026-10-18', 'quick', '{"kind":"quick"}', '{"kcal":1,"protein_g":1,"fat_g":1,"carbs_g":1,"fibre_g":1,"sugars_g":"1"}')$$,
  '23514',
  'new row for relation "food_log_entries" violates check constraint "food_log_entries_nutrients_required_keys"',
  'a string sugars_g is rejected'
);
select throws_ok(
  $$update public.food_log_entries set nutrients = '{"kcal":1,"protein_g":1,"fat_g":1,"carbs_g":1,"fibre_g":1,"salt_g":"abc"}' where id = '18200000-0000-4000-8000-0000000003a1'$$,
  '23514',
  'new row for relation "food_log_entries" violates check constraint "food_log_entries_nutrients_required_keys"',
  'a string salt_g is rejected on update too'
);

-- Sums, read as postgres so they do not depend on row level security.
-- 2026-10-15, user A: the null nutrient is skipped in the sum.
select is(
  (select kcal from public.day_totals where user_id = '18200000-0000-4000-8000-00000000000a' and local_date = '2026-10-15'),
  350::numeric,
  'kcal is the sum of the live entries'
);
select is(
  (select protein_g from public.day_totals where user_id = '18200000-0000-4000-8000-00000000000a' and local_date = '2026-10-15'),
  10::numeric,
  'a null protein is skipped, so the day totals the entry that knows it'
);
select is(
  (select fat_g from public.day_totals where user_id = '18200000-0000-4000-8000-00000000000a' and local_date = '2026-10-15'),
  12::numeric,
  'fat is the sum of the live entries'
);
select is(
  (select carbs_g from public.day_totals where user_id = '18200000-0000-4000-8000-00000000000a' and local_date = '2026-10-15'),
  50::numeric,
  'carbs is the sum of the live entries'
);
select is(
  (select fibre_g from public.day_totals where user_id = '18200000-0000-4000-8000-00000000000a' and local_date = '2026-10-15'),
  null::numeric,
  'fibre is null, not 0, when every live entry leaves it null'
);
select is(
  (select sat_fat_g from public.day_totals where user_id = '18200000-0000-4000-8000-00000000000a' and local_date = '2026-10-15'),
  2::numeric,
  'an absent optional key is skipped, so sat_fat_g totals the entry that has it'
);
select is(
  (select sugars_g from public.day_totals where user_id = '18200000-0000-4000-8000-00000000000a' and local_date = '2026-10-15'),
  3::numeric,
  'sugars_g totals the entry that has it'
);
select is(
  (select salt_g from public.day_totals where user_id = '18200000-0000-4000-8000-00000000000a' and local_date = '2026-10-15'),
  1.5::numeric,
  'salt_g totals the entry that has it'
);
select is(
  (select entry_count from public.day_totals where user_id = '18200000-0000-4000-8000-00000000000a' and local_date = '2026-10-15'),
  2,
  'entry_count counts the live entries and not the soft deleted one'
);

-- 2026-10-14, user A: one live entry with every nutrient null.
select results_eq(
  $$select kcal is null, protein_g is null, fat_g is null, carbs_g is null, fibre_g is null, sat_fat_g is null, sugars_g is null, salt_g is null
    from public.day_totals where user_id = '18200000-0000-4000-8000-00000000000a' and local_date = '2026-10-14'$$,
  $$values (true, true, true, true, true, true, true, true)$$,
  'a day whose only entry has every nutrient null totals null for every nutrient, not 0'
);
select is(
  (select entry_count from public.day_totals where user_id = '18200000-0000-4000-8000-00000000000a' and local_date = '2026-10-14'),
  1,
  'an entry with every nutrient null still counts as an entry'
);

-- 2026-10-13, user A: only a soft deleted entry.
select is(
  (select count(*)::int from public.day_totals where user_id = '18200000-0000-4000-8000-00000000000a' and local_date = '2026-10-13'),
  0,
  'a day whose entries are all soft deleted has no row'
);

-- 2026-10-16, user A: grouped by local_date, not by logged_at.
select is(
  (select count(*)::int from public.day_totals where user_id = '18200000-0000-4000-8000-00000000000a' and local_date = '2026-10-16'),
  1,
  'entries logged on two UTC days but with one local_date make one row'
);
select is(
  (select entry_count from public.day_totals where user_id = '18200000-0000-4000-8000-00000000000a' and local_date = '2026-10-16'),
  2,
  'both entries of that local_date are counted'
);
select is(
  (select kcal from public.day_totals where user_id = '18200000-0000-4000-8000-00000000000a' and local_date = '2026-10-16'),
  30::numeric,
  'both entries of that local_date are summed'
);
select is(
  (select count(*)::int from public.day_totals where user_id = '18200000-0000-4000-8000-00000000000a' and local_date = '2026-10-17'),
  0,
  'the UTC day of the later logged_at gets no row'
);

-- Rows are per user: user B's day is not mixed into user A's.
select is(
  (select kcal from public.day_totals where user_id = '18200000-0000-4000-8000-00000000000b' and local_date = '2026-10-15'),
  5000::numeric,
  'user B has their own total for the same local day'
);
select is(
  (select count(*)::int from public.day_totals where user_id::text like '18200000-%'),
  4,
  'there is one row per user per live day: three for user A, one for user B'
);

-- User A reads through row level security.
set local role authenticated;
set local request.jwt.claims = '{"sub":"18200000-0000-4000-8000-00000000000a","role":"authenticated"}';

select is(
  (select count(*)::int from public.day_totals where user_id::text like '18200000-%'),
  3,
  'user A sees only their own three days'
);
select is(
  (select count(*)::int from public.day_totals where user_id = '18200000-0000-4000-8000-00000000000b'),
  0,
  'user A sees nothing of user B'
);
select is(
  (select kcal from public.day_totals where local_date = '2026-10-15' and user_id::text like '18200000-%'),
  350::numeric,
  'user A''s total for the shared day is their own, without user B''s 5000'
);
select throws_ok(
  $$insert into public.day_totals (user_id, local_date) values ('18200000-0000-4000-8000-00000000000a', '2026-10-20')$$,
  '55000',
  'cannot insert into view "day_totals"',
  'a client cannot write to day_totals, which is not an updatable view'
);

-- A soft delete leaves the day's total; an undo brings it back.
update public.food_log_entries set deleted_at = now() where id = '18200000-0000-4000-8000-0000000003a2';

select results_eq(
  $$select kcal, entry_count from public.day_totals where local_date = '2026-10-15' and user_id::text like '18200000-%'$$,
  $$values (100::numeric, 1)$$,
  'soft deleting an entry removes it from the day''s total and count'
);

update public.food_log_entries set deleted_at = null where id = '18200000-0000-4000-8000-0000000003a2';

select results_eq(
  $$select kcal, entry_count from public.day_totals where local_date = '2026-10-15' and user_id::text like '18200000-%'$$,
  $$values (350::numeric, 2)$$,
  'clearing deleted_at puts the entry back in the total and count'
);

reset role;

-- User B reads through row level security.
set local role authenticated;
set local request.jwt.claims = '{"sub":"18200000-0000-4000-8000-00000000000b","role":"authenticated"}';

select is(
  (select count(*)::int from public.day_totals where user_id::text like '18200000-%'),
  1,
  'user B sees only their own day'
);
select is(
  (select count(*)::int from public.day_totals where user_id = '18200000-0000-4000-8000-00000000000a'),
  0,
  'user B sees nothing of user A'
);

reset role;

-- Anon.
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

select throws_ok(
  'select * from public.day_totals',
  '42501',
  'permission denied for view day_totals',
  'anon cannot select from day_totals'
);

reset role;

select * from finish();

rollback;
