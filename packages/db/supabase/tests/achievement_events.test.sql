-- Asserts the achievement events table and the event_counts key of achievement_stats (ADR 0003,
-- Amendment 27): the privileges, the checks, the unique key that makes a barcode count once, the owner
-- only policies, and the seven counts.
--
-- `supabase test db` runs this file as postgres inside a transaction that is rolled back, so nothing
-- created here persists. Every fixture id starts with 10940000 and every email with key1094. Each actor
-- is entered with `set local role` plus the JWT claims that `auth.uid()` reads, and left with
-- `reset role`.
--
-- Three users. A records events and is the user whose counts are read. B is a stranger with events of
-- their own, to prove nothing crosses. C has none, so every count reads zero.

begin;

select plan(52);

insert into auth.users (instance_id, id, aud, role, email) values
  ('00000000-0000-0000-0000-000000000000', '10940000-0000-4000-8000-0000000000aa', 'authenticated', 'authenticated', 'key1094-a@keylow.test'),
  ('00000000-0000-0000-0000-000000000000', '10940000-0000-4000-8000-0000000000bb', 'authenticated', 'authenticated', 'key1094-b@keylow.test'),
  ('00000000-0000-0000-0000-000000000000', '10940000-0000-4000-8000-0000000000cc', 'authenticated', 'authenticated', 'key1094-c@keylow.test');

-- B has events of every kind, fixtures inserted as postgres so row level security does not apply.
insert into public.achievement_events (user_id, kind, ref) values
  ('10940000-0000-4000-8000-0000000000bb', 'barcode_scanned', 'k1094-b-code'),
  ('10940000-0000-4000-8000-0000000000bb', 'exercise_demo_opened', 'k1094-b-exercise'),
  ('10940000-0000-4000-8000-0000000000bb', 'week_view_opened', null),
  ('10940000-0000-4000-8000-0000000000bb', 'data_exported', null),
  ('10940000-0000-4000-8000-0000000000bb', 'log_from_favourites', null),
  ('10940000-0000-4000-8000-0000000000bb', 'shopping_item_ticked', null),
  ('10940000-0000-4000-8000-0000000000bb', 'recipe_draft_saved', null);

-- ---------------------------------------------------------------------------------------------
-- Shape.
-- ---------------------------------------------------------------------------------------------

select has_table('public', 'achievement_events', 'achievement_events exists');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.achievement_events'::regclass),
  'row level security is enabled on achievement_events'
);
select col_is_pk('public', 'achievement_events', 'id', 'the primary key is id');
select col_default_is('public', 'achievement_events', 'user_id', 'auth.uid()', 'user_id defaults to the caller');
select col_not_null('public', 'achievement_events', 'kind', 'kind is not null');
select col_is_null('public', 'achievement_events', 'ref', 'ref may be null');
select col_type_is('public', 'achievement_events', 'created_at', 'timestamp with time zone', 'created_at is a timestamptz');
select fk_ok('public', 'achievement_events', 'user_id', 'auth', 'users', 'id', 'achievement_events.user_id references auth.users');
select policies_are(
  'public',
  'achievement_events',
  array['achievement_events_select_own', 'achievement_events_insert_own'],
  'achievement_events has a select and an insert policy and no other'
);

-- ---------------------------------------------------------------------------------------------
-- Privileges.
-- ---------------------------------------------------------------------------------------------

select ok(
  not has_table_privilege('anon', 'public.achievement_events', 'select')
    and not has_table_privilege('anon', 'public.achievement_events', 'insert'),
  'anon has no access to achievement_events'
);
select ok(
  has_table_privilege('authenticated', 'public.achievement_events', 'select')
    and not has_table_privilege('authenticated', 'public.achievement_events', 'update')
    and not has_table_privilege('authenticated', 'public.achievement_events', 'delete'),
  'authenticated reads achievement_events, with no update and no delete'
);
select ok(
  has_column_privilege('authenticated', 'public.achievement_events', 'kind', 'insert')
    and has_column_privilege('authenticated', 'public.achievement_events', 'ref', 'insert')
    and not has_column_privilege('authenticated', 'public.achievement_events', 'user_id', 'insert')
    and not has_column_privilege('authenticated', 'public.achievement_events', 'created_at', 'insert')
    and not has_column_privilege('authenticated', 'public.achievement_events', 'id', 'insert'),
  'authenticated inserts kind and ref only'
);
select ok(
  has_table_privilege('service_role', 'public.achievement_events', 'select')
    and not has_table_privilege('service_role', 'public.achievement_events', 'insert')
    and not has_table_privilege('service_role', 'public.achievement_events', 'update')
    and not has_table_privilege('service_role', 'public.achievement_events', 'delete'),
  'service_role reads achievement_events and writes nothing'
);
select ok(
  has_function_privilege('authenticated', 'public.achievement_stats(date)', 'execute')
    and not has_function_privilege('anon', 'public.achievement_stats(date)', 'execute')
    and not has_function_privilege('service_role', 'public.achievement_stats(date)', 'execute'),
  'replacing achievement_stats kept its grants: authenticated only'
);
select is(
  (select prosecdef from pg_proc where oid = 'public.achievement_stats(date)'::regprocedure),
  false,
  'achievement_stats is still security invoker'
);

-- ---------------------------------------------------------------------------------------------
-- Checks, as A. A bad row is refused before any policy is asked.
-- ---------------------------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub":"10940000-0000-4000-8000-0000000000aa","role":"authenticated"}';

select throws_ok(
  $$insert into public.achievement_events (kind) values ('made_up_kind')$$,
  '23514',
  null,
  'a kind outside the list is refused'
);
select throws_ok(
  $$insert into public.achievement_events (kind) values ('barcode_scanned')$$,
  '23514',
  null,
  'a barcode scan with no ref is refused, so a null cannot dodge the unique key'
);
select throws_ok(
  $$insert into public.achievement_events (kind, ref) values ('exercise_demo_opened', null)$$,
  '23514',
  null,
  'an exercise demo with no ref is refused'
);
select throws_ok(
  $$insert into public.achievement_events (kind, ref) values ('barcode_scanned', '')$$,
  '23514',
  null,
  'an empty ref is refused'
);
select throws_ok(
  $$insert into public.achievement_events (kind, ref) values ('barcode_scanned', repeat('1', 65))$$,
  '23514',
  null,
  'a ref of more than 64 characters is refused'
);
select throws_ok(
  $$insert into public.achievement_events (kind, ref) values ('week_view_opened', 'k1094-code')$$,
  '23514',
  null,
  'an event that counts every time may not carry a ref'
);

-- ---------------------------------------------------------------------------------------------
-- Writes, as A.
-- ---------------------------------------------------------------------------------------------

select lives_ok(
  $$insert into public.achievement_events (kind, ref) values ('barcode_scanned', 'k1094-code-1')$$,
  'A records a barcode scan'
);
select throws_ok(
  $$insert into public.achievement_events (kind, ref) values ('barcode_scanned', 'k1094-code-1')$$,
  '23505',
  'duplicate key value violates unique constraint "achievement_events_user_id_kind_ref_key"',
  'the same barcode again is a duplicate'
);
select lives_ok(
  $$insert into public.achievement_events (kind, ref) values ('barcode_scanned', 'k1094-code-1') on conflict do nothing$$,
  'the same barcode again with on conflict do nothing is quietly ignored'
);
select is(
  (select count(*) from public.achievement_events where kind = 'barcode_scanned'),
  1::bigint,
  'the barcode is one row after three attempts'
);
select lives_ok(
  $$insert into public.achievement_events (kind, ref) values ('barcode_scanned', 'k1094-code-2'), ('exercise_demo_opened', 'k1094-exercise-1'), ('exercise_demo_opened', 'k1094-exercise-2')$$,
  'A records a second barcode and two exercise demos'
);
select lives_ok(
  $$insert into public.achievement_events (kind, ref) values
      ('week_view_opened', null), ('week_view_opened', null), ('week_view_opened', null),
      ('data_exported', null), ('data_exported', null),
      ('log_from_favourites', null), ('log_from_favourites', null), ('log_from_favourites', null), ('log_from_favourites', null),
      ('shopping_item_ticked', null), ('shopping_item_ticked', null), ('shopping_item_ticked', null), ('shopping_item_ticked', null), ('shopping_item_ticked', null),
      ('recipe_draft_saved', null)$$,
  'A records events with no ref, the same kind more than once'
);
select is(
  (select count(*) from public.achievement_events where kind = 'week_view_opened'),
  3::bigint,
  'an event with no ref counts every time it is recorded'
);
select lives_ok(
  $$insert into public.achievement_events (kind, ref) values ('exercise_demo_opened', 'k1094-exercise-1') on conflict do nothing$$,
  'the same exercise demo again is quietly ignored'
);
select is(
  (select user_id from public.achievement_events where ref = 'k1094-code-1'),
  '10940000-0000-4000-8000-0000000000aa'::uuid,
  'user_id was filled from the caller'
);
select throws_ok(
  $$insert into public.achievement_events (user_id, kind) values ('10940000-0000-4000-8000-0000000000bb', 'week_view_opened')$$,
  '42501',
  null,
  'A cannot name another owner: user_id is not in the insert grant'
);
select throws_ok(
  $$update public.achievement_events set kind = 'data_exported' where kind = 'week_view_opened'$$,
  '42501',
  null,
  'A cannot update an event'
);
select throws_ok(
  $$delete from public.achievement_events where kind = 'week_view_opened'$$,
  '42501',
  null,
  'A cannot delete an event'
);
select is(
  (select count(*) from public.achievement_events),
  19::bigint,
  'A sees its own 19 events and none of B''s'
);

-- ---------------------------------------------------------------------------------------------
-- The counts, as A. Every number is a literal worked out from the inserts above.
-- ---------------------------------------------------------------------------------------------

select is(
  public.achievement_stats(null) -> 'event_counts' ->> 'distinct_barcodes_scanned',
  '2',
  'A has scanned two different barcodes'
);
select is(
  public.achievement_stats(null) -> 'event_counts' ->> 'exercise_demos_watched',
  '2',
  'A has watched the demo of two exercises'
);
select is(
  public.achievement_stats(null) -> 'event_counts' ->> 'week_view_opens',
  '3',
  'A has opened the week view three times'
);
select is(
  public.achievement_stats(null) -> 'event_counts' ->> 'data_exports',
  '2',
  'A has exported twice'
);
select is(
  public.achievement_stats(null) -> 'event_counts' ->> 'logs_from_favourites',
  '4',
  'A has logged from favourites four times'
);
select is(
  public.achievement_stats(null) -> 'event_counts' ->> 'shopping_items_ticked_off',
  '5',
  'A has ticked five shopping items'
);
select is(
  public.achievement_stats(null) -> 'event_counts' ->> 'assistant_drafts_saved',
  '1',
  'A has saved one assistant draft'
);
select is(
  (select array_agg(key order by key) from jsonb_object_keys(public.achievement_stats(null) -> 'event_counts') as key),
  array[
    'assistant_drafts_saved', 'data_exports', 'distinct_barcodes_scanned', 'exercise_demos_watched',
    'logs_from_favourites', 'shopping_items_ticked_off', 'week_view_opens'
  ],
  'event_counts holds exactly the seven counts'
);
select ok(
  (public.achievement_stats(null) ?& array[
    'profile_created_at', 'days', 'entry_totals', 'workouts', 'assistant_create_recipe_actions',
    'feature_requests', 'achievements', 'streak_freeze_events'
  ]),
  'the keys that were already in the snapshot are still there'
);

-- ---------------------------------------------------------------------------------------------
-- B reads its own, and C has nothing.
-- ---------------------------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"10940000-0000-4000-8000-0000000000bb","role":"authenticated"}';

select is(
  (select count(*) from public.achievement_events where user_id = '10940000-0000-4000-8000-0000000000aa'),
  0::bigint,
  'B cannot read A''s events'
);
select is(
  (select count(*) from public.achievement_events),
  7::bigint,
  'B sees its own seven events'
);
select is(
  public.achievement_stats(null) -> 'event_counts' ->> 'distinct_barcodes_scanned',
  '1',
  'B has scanned one barcode, none of A''s'
);
select is(
  public.achievement_stats(null) -> 'event_counts' ->> 'week_view_opens',
  '1',
  'B has opened the week view once, none of A''s'
);

set local request.jwt.claims = '{"sub":"10940000-0000-4000-8000-0000000000cc","role":"authenticated"}';

select is(
  (select count(*) from public.achievement_events),
  0::bigint,
  'C sees no events'
);
select is(
  public.achievement_stats(null) -> 'event_counts',
  '{
    "distinct_barcodes_scanned": 0,
    "exercise_demos_watched": 0,
    "week_view_opens": 0,
    "data_exports": 0,
    "logs_from_favourites": 0,
    "shopping_items_ticked_off": 0,
    "assistant_drafts_saved": 0
  }'::jsonb,
  'C, with no events, has every count at zero and none missing'
);

-- ---------------------------------------------------------------------------------------------
-- Distinct counting is the function's own, not only the unique key's. The key is dropped inside this
-- transaction, a barcode and an exercise are written twice, and the counts still read one of each.
-- ---------------------------------------------------------------------------------------------

reset role;

alter table public.achievement_events drop constraint achievement_events_user_id_kind_ref_key;

insert into public.achievement_events (user_id, kind, ref) values
  ('10940000-0000-4000-8000-0000000000cc', 'barcode_scanned', 'k1094-c-code'),
  ('10940000-0000-4000-8000-0000000000cc', 'barcode_scanned', 'k1094-c-code'),
  ('10940000-0000-4000-8000-0000000000cc', 'exercise_demo_opened', 'k1094-c-exercise'),
  ('10940000-0000-4000-8000-0000000000cc', 'exercise_demo_opened', 'k1094-c-exercise');

set local role authenticated;
set local request.jwt.claims = '{"sub":"10940000-0000-4000-8000-0000000000cc","role":"authenticated"}';

select is(
  public.achievement_stats(null) -> 'event_counts' ->> 'distinct_barcodes_scanned',
  '1',
  'the same barcode twice counts once, in the function and not only through the unique key'
);
select is(
  public.achievement_stats(null) -> 'event_counts' ->> 'exercise_demos_watched',
  '1',
  'the same exercise twice counts once, in the function and not only through the unique key'
);

-- ---------------------------------------------------------------------------------------------
-- Deleting the account deletes its events.
-- ---------------------------------------------------------------------------------------------

reset role;

delete from auth.users where id = '10940000-0000-4000-8000-0000000000bb';

select is(
  (select count(*) from public.achievement_events where user_id = '10940000-0000-4000-8000-0000000000bb'),
  0::bigint,
  'deleting B deletes its events'
);

select * from finish();

rollback;
