-- Asserts public.food_log_entries.updated_at (KEY-688, ADR 0003 Amendment 14, addendum of 2026-11-03):
-- the column exists and is never null, an insert gets the default, every update stamps it with the
-- transaction's time whatever the statement sent, one statement over several rows gives them all the
-- same instant, a soft delete and a restore move it, and a client holds no grant to write it.
--
-- `supabase test db` runs this file as postgres inside a transaction that is rolled back, so nothing
-- created here persists. Every fixture id starts with 68800000 and the email with key688-. The actor is
-- entered with `set local role` plus the JWT claims that `auth.uid()` reads, and left with `reset role`.

begin;

select plan(14);

insert into auth.users (instance_id, id, aud, role, email) values
  ('00000000-0000-0000-0000-000000000000', '68800000-0000-4000-8000-00000000000a', 'authenticated', 'authenticated', 'key688-user-a@keylow.test');

-- Two quick entries for the user, written with an old updated_at so a stamp is visible inside one transaction.
insert into public.food_log_entries (id, user_id, local_date, logged_at, item_type, snapshot, nutrients, updated_at) values
  ('68800000-0000-4000-8000-0000000003a1', '68800000-0000-4000-8000-00000000000a', '2026-11-03', '2026-11-03 08:00:00+00', 'quick', '{"kind":"quick","label":"key688-one"}', '{"kcal":100,"protein_g":null,"fat_g":null,"carbs_g":null,"fibre_g":null}', '2026-01-01 00:00:00+00'),
  ('68800000-0000-4000-8000-0000000003a2', '68800000-0000-4000-8000-00000000000a', '2026-11-03', '2026-11-03 09:00:00+00', 'quick', '{"kind":"quick","label":"key688-two"}', '{"kcal":200,"protein_g":null,"fat_g":null,"carbs_g":null,"fibre_g":null}', '2026-01-01 00:00:00+00');

select col_type_is('public', 'food_log_entries', 'updated_at', 'timestamp with time zone', 'updated_at is a timestamptz');
select col_not_null('public', 'food_log_entries', 'updated_at', 'updated_at is not null');
select col_has_default('public', 'food_log_entries', 'updated_at', 'updated_at has a default');

-- An insert that sends no updated_at gets the transaction time.
insert into public.food_log_entries (id, user_id, local_date, logged_at, item_type, snapshot, nutrients) values
  ('68800000-0000-4000-8000-0000000003a3', '68800000-0000-4000-8000-00000000000a', '2026-11-03', '2026-11-03 10:00:00+00', 'quick', '{"kind":"quick","label":"key688-three"}', '{"kcal":300,"protein_g":null,"fat_g":null,"carbs_g":null,"fibre_g":null}');
select is(
  (select updated_at from public.food_log_entries where id = '68800000-0000-4000-8000-0000000003a3'),
  now(),
  'an insert that sends no updated_at gets the default'
);

-- An update stamps the row, and an update that sends its own updated_at is overwritten.
update public.food_log_entries set nutrients = '{"kcal":150,"protein_g":null,"fat_g":null,"carbs_g":null,"fibre_g":null}', updated_at = '2020-01-01 00:00:00+00'
  where id = '68800000-0000-4000-8000-0000000003a1';
select is(
  (select updated_at from public.food_log_entries where id = '68800000-0000-4000-8000-0000000003a1'),
  now(),
  'an update stamps updated_at with the transaction time and ignores a value sent for it'
);
select is(
  (select updated_at from public.food_log_entries where id = '68800000-0000-4000-8000-0000000003a2'),
  '2026-01-01 00:00:00+00'::timestamptz,
  'an update of one row leaves the other row alone'
);

-- One statement over several rows gives them the same instant.
update public.food_log_entries set deleted_at = '2026-11-03 12:00:00+00'
  where id in ('68800000-0000-4000-8000-0000000003a1', '68800000-0000-4000-8000-0000000003a2');
select is(
  (select count(distinct updated_at) from public.food_log_entries where id in ('68800000-0000-4000-8000-0000000003a1', '68800000-0000-4000-8000-0000000003a2')),
  1::bigint,
  'one update over two rows gives them one updated_at'
);
select is(
  (select updated_at from public.food_log_entries where id = '68800000-0000-4000-8000-0000000003a2'),
  now(),
  'a soft delete moves updated_at'
);

-- The owner's own update through the API role stamps it too, and a restore moves it again.
-- The trigger would overwrite the old value this puts back, so it is off for that one statement.
alter table public.food_log_entries disable trigger food_log_entries_stamp_updated_at;
update public.food_log_entries set updated_at = '2026-01-01 00:00:00+00' where id = '68800000-0000-4000-8000-0000000003a2';
alter table public.food_log_entries enable trigger food_log_entries_stamp_updated_at;
set local role authenticated;
set local request.jwt.claims = '{"sub":"68800000-0000-4000-8000-00000000000a","role":"authenticated"}';

update public.food_log_entries set deleted_at = null where id = '68800000-0000-4000-8000-0000000003a2';
select is(
  (select updated_at from public.food_log_entries where id = '68800000-0000-4000-8000-0000000003a2'),
  now(),
  'a restore by the owner moves updated_at'
);
select is(
  (select deleted_at from public.food_log_entries where id = '68800000-0000-4000-8000-0000000003a2'),
  null::timestamptz,
  'the restore cleared deleted_at'
);

select throws_ok(
  $$update public.food_log_entries set updated_at = '2020-01-01 00:00:00+00' where id = '68800000-0000-4000-8000-0000000003a2'$$,
  '42501',
  null,
  'a client holds no grant to write updated_at'
);
select throws_ok(
  $$insert into public.food_log_entries (user_id, local_date, logged_at, item_type, snapshot, nutrients, updated_at) values ('68800000-0000-4000-8000-00000000000a', '2026-11-03', '2026-11-03 11:00:00+00', 'quick', '{}', '{"kcal":1,"protein_g":null,"fat_g":null,"carbs_g":null,"fibre_g":null}', '2020-01-01 00:00:00+00')$$,
  '42501',
  null,
  'a client holds no grant to insert updated_at'
);
reset role;

select ok(
  not has_function_privilege('authenticated', 'public.food_log_entries_stamp_updated_at()', 'execute')
  and not has_function_privilege('anon', 'public.food_log_entries_stamp_updated_at()', 'execute'),
  'nobody holds execute on the stamping function'
);
select has_trigger('public', 'food_log_entries', 'food_log_entries_stamp_updated_at', 'the stamping trigger is on food_log_entries');

select * from finish();

rollback;
