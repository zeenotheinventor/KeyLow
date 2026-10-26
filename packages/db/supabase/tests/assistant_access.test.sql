-- Asserts public.entitlements, the functions public.assistant_access() and public.has_entitlement(), the
-- consent columns on public.profiles and public.recipes.source_url with its use through
-- public.save_recipe (ADR 0003, Amendment 14, and ADR 0006): the columns, the checks, the privileges, the
-- owner-only policy, the free plan as a default, a live and an expired row, the plus and unlimited plans,
-- the consent pair, the link check and the three ways a save treats the link.
--
-- `supabase test db` runs this file as postgres inside a transaction that is rolled back, so nothing
-- created here persists. Every fixture id starts with 66600000 and every email and name with key666-.
-- Each actor is entered with `set local role` plus the JWT claims that `auth.uid()` reads, and left with
-- `reset role`.
--
-- No fixture is health data. A recipe is a made-up name, and a link points at the reserved example.com.
-- Rows are found by their owner or their id, never by a whole-table count, because the shared database
-- can hold other rows and a real person can have consented.
--
-- Fixture users: a and b (consent, the owner-only read, and the recipe link: a owns the recipe b tries to
-- change), c to j (one entitlement shape each, read through assistant_access), k (the cascade from the
-- auth user).

begin;

select plan(136);

insert into auth.users (instance_id, id, aud, role, email) values
  ('00000000-0000-0000-0000-000000000000', '66600000-0000-4000-8000-0000000000aa', 'authenticated', 'authenticated', 'key666-user-a@keylow.test'),
  ('00000000-0000-0000-0000-000000000000', '66600000-0000-4000-8000-0000000000bb', 'authenticated', 'authenticated', 'key666-user-b@keylow.test'),
  ('00000000-0000-0000-0000-000000000000', '66600000-0000-4000-8000-0000000000cc', 'authenticated', 'authenticated', 'key666-user-c@keylow.test'),
  ('00000000-0000-0000-0000-000000000000', '66600000-0000-4000-8000-0000000000dd', 'authenticated', 'authenticated', 'key666-user-d@keylow.test'),
  ('00000000-0000-0000-0000-000000000000', '66600000-0000-4000-8000-0000000000ee', 'authenticated', 'authenticated', 'key666-user-e@keylow.test'),
  ('00000000-0000-0000-0000-000000000000', '66600000-0000-4000-8000-0000000000ff', 'authenticated', 'authenticated', 'key666-user-f@keylow.test'),
  ('00000000-0000-0000-0000-000000000000', '66600000-0000-4000-8000-0000000000a1', 'authenticated', 'authenticated', 'key666-user-g@keylow.test'),
  ('00000000-0000-0000-0000-000000000000', '66600000-0000-4000-8000-0000000000a2', 'authenticated', 'authenticated', 'key666-user-h@keylow.test'),
  ('00000000-0000-0000-0000-000000000000', '66600000-0000-4000-8000-0000000000a3', 'authenticated', 'authenticated', 'key666-user-i@keylow.test'),
  ('00000000-0000-0000-0000-000000000000', '66600000-0000-4000-8000-0000000000a4', 'authenticated', 'authenticated', 'key666-user-j@keylow.test'),
  ('00000000-0000-0000-0000-000000000000', '66600000-0000-4000-8000-0000000000a5', 'authenticated', 'authenticated', 'key666-user-k@keylow.test');

-- The profiles the trigger just made have no consent, so the assistant is off by default. This runs before
-- any case changes a profile, and looks only at this file's own users.
select is(
  (select count(*)::int from public.profiles
    where id::text like '66600000-0000-4000-8000-0000000000%'
      and (assistant_consent_at is not null or assistant_consent_version is not null)),
  0,
  'no profile of this file has consent, so the assistant is off by default'
);
select is(
  (select count(*)::int from public.profiles
    where id in ('66600000-0000-4000-8000-0000000000aa', '66600000-0000-4000-8000-0000000000bb')
      and assistant_consent_at is null and assistant_consent_version is null),
  2,
  'a new profile is created with both consent columns null'
);

-- The number of rows a statement affected, for the cases where row level security makes an update match
-- nothing instead of raising an error.
create function pg_temp.affected_rows(statement text)
returns bigint
language plpgsql
as $$
declare
  affected bigint;
begin
  execute statement;
  get diagnostics affected = row_count;
  return affected;
end;
$$;

-- A recipe payload for save_recipe. The tests add or leave out the source_url key.
create function pg_temp.recipe(recipe_name text)
returns jsonb language sql as $$
  select jsonb_build_object(
    'name', recipe_name, 'servings', 2, 'yield_grams', 500, 'instructions', '[]'::jsonb,
    'computed', '{"total":{"kcal":null},"engineVersion":1}'::jsonb
  )
$$;

-- Entitlement fixtures, inserted as postgres so row level security and the grants do not apply:
--   b  a plus row that expires tomorrow, with its own limit of 30
--   c  a plus row that expired a second ago
--   d  an unlimited row that never expires and holds no limit
--   e  an unlimited row that expires tomorrow and holds a limit of 40
--   f  an unlimited row that expired yesterday
--   g  a plus row that never expires and holds no limit
--   h  a free row with a limit of 5
--   i  a plus row that expires at this very instant
--   k  a plus row, to prove the cascade from the auth user
-- a and j have no row.
insert into public.entitlements (user_id, feature, plan, source, expires_at, daily_turns) values
  ('66600000-0000-4000-8000-0000000000bb', 'assistant', 'plus', 'manual', now() + interval '1 day', 30),
  ('66600000-0000-4000-8000-0000000000cc', 'assistant', 'plus', 'manual', now() - interval '1 second', 30),
  ('66600000-0000-4000-8000-0000000000dd', 'assistant', 'unlimited', 'manual', null, null),
  ('66600000-0000-4000-8000-0000000000ee', 'assistant', 'unlimited', 'manual', now() + interval '1 day', 40),
  ('66600000-0000-4000-8000-0000000000ff', 'assistant', 'unlimited', 'manual', now() - interval '1 day', null),
  ('66600000-0000-4000-8000-0000000000a1', 'assistant', 'plus', 'manual', null, null),
  ('66600000-0000-4000-8000-0000000000a2', 'assistant', 'free', 'manual', null, 5),
  ('66600000-0000-4000-8000-0000000000a3', 'assistant', 'plus', 'manual', now(), 30),
  ('66600000-0000-4000-8000-0000000000a5', 'assistant', 'plus', 'manual', null, null);

-- Shape: entitlements.
select has_table('public', 'entitlements', 'entitlements exists');
select columns_are(
  'public',
  'entitlements',
  array['user_id', 'feature', 'plan', 'granted_at', 'expires_at', 'source', 'daily_turns'],
  'entitlements has exactly the Amendment 14 columns'
);
select col_is_pk('public', 'entitlements', array['user_id', 'feature'], 'the primary key is user_id and feature');
select col_type_is('public', 'entitlements', 'user_id', 'uuid', 'user_id is a uuid');
select col_type_is('public', 'entitlements', 'granted_at', 'timestamp with time zone', 'granted_at is a timestamptz');
select col_type_is('public', 'entitlements', 'expires_at', 'timestamp with time zone', 'expires_at is a timestamptz');
select col_type_is('public', 'entitlements', 'daily_turns', 'integer', 'daily_turns is an integer');
select col_not_null('public', 'entitlements', 'feature', 'feature is not null');
select col_not_null('public', 'entitlements', 'plan', 'plan is not null');
select col_not_null('public', 'entitlements', 'granted_at', 'granted_at is not null');
select col_not_null('public', 'entitlements', 'source', 'source is not null');
select col_is_null('public', 'entitlements', 'expires_at', 'expires_at is nullable, null meaning the row does not expire');
select col_is_null('public', 'entitlements', 'daily_turns', 'daily_turns is nullable');
select col_has_default('public', 'entitlements', 'granted_at', 'granted_at has a default');
select col_hasnt_default('public', 'entitlements', 'source', 'source has no default, so a row says where it came from');
select fk_ok('public', 'entitlements', 'user_id', 'auth', 'users', 'id', 'user_id references auth.users');
select is(
  (select count(*)::int from public.entitlements where user_id = '66600000-0000-4000-8000-0000000000aa'),
  0,
  'a user with no grant has no row, because the free plan is a default and not a row'
);

-- Checks.
select throws_ok(
  $$insert into public.entitlements (user_id, feature, plan, source) values ('66600000-0000-4000-8000-0000000000a4', 'coaching', 'plus', 'manual')$$,
  '23514',
  'new row for relation "entitlements" violates check constraint "entitlements_feature_check"',
  'a feature other than assistant is refused'
);
select throws_ok(
  $$insert into public.entitlements (user_id, feature, plan, source) values ('66600000-0000-4000-8000-0000000000a4', 'assistant', 'gold', 'manual')$$,
  '23514',
  'new row for relation "entitlements" violates check constraint "entitlements_plan_check"',
  'a plan other than free, plus or unlimited is refused'
);
select throws_ok(
  $$insert into public.entitlements (user_id, feature, plan, source, daily_turns) values ('66600000-0000-4000-8000-0000000000a4', 'assistant', 'plus', 'manual', 0)$$,
  '23514',
  'new row for relation "entitlements" violates check constraint "entitlements_daily_turns_check"',
  'a daily limit of 0 is refused, because consume_rate_limit raises for a limit below 1'
);
select throws_ok(
  $$insert into public.entitlements (user_id, feature, plan, source, daily_turns) values ('66600000-0000-4000-8000-0000000000a4', 'assistant', 'plus', 'manual', -3)$$,
  '23514',
  'new row for relation "entitlements" violates check constraint "entitlements_daily_turns_check"',
  'a negative daily limit is refused'
);
select throws_ok(
  $$insert into public.entitlements (user_id, feature, plan, source) values ('66600000-0000-4000-8000-0000000000a4', 'assistant', null, 'manual')$$,
  '23502',
  'null value in column "plan" of relation "entitlements" violates not-null constraint',
  'a row with no plan is refused'
);
select throws_ok(
  $$insert into public.entitlements (user_id, feature, plan, source) values ('66600000-0000-4000-8000-0000000000a4', 'assistant', 'plus', null)$$,
  '23502',
  'null value in column "source" of relation "entitlements" violates not-null constraint',
  'a row with no source is refused'
);
select throws_ok(
  $$insert into public.entitlements (user_id, feature, plan, source) values ('66600000-0000-4000-8000-0000000000bb', 'assistant', 'plus', 'manual')$$,
  '23505',
  'duplicate key value violates unique constraint "entitlements_pkey"',
  'a user has one row per feature'
);
select lives_ok(
  $$insert into public.entitlements (user_id, feature, plan, source, daily_turns) values ('66600000-0000-4000-8000-0000000000a4', 'assistant', 'plus', 'manual', 1)$$,
  'a daily limit of 1 is accepted'
);
delete from public.entitlements where user_id = '66600000-0000-4000-8000-0000000000a4';

-- Privileges: entitlements.
select ok(
  (select relrowsecurity from pg_class where oid = 'public.entitlements'::regclass),
  'row level security is enabled on entitlements'
);
select ok(
  not has_table_privilege('anon', 'public.entitlements', 'select,insert,update,delete')
    and not has_any_column_privilege('anon', 'public.entitlements', 'select')
    and not has_any_column_privilege('anon', 'public.entitlements', 'insert')
    and not has_any_column_privilege('anon', 'public.entitlements', 'update'),
  'anon has no privilege on entitlements'
);
select is(
  (select array_agg(privilege_type::text order by privilege_type::text) from information_schema.table_privileges
    where table_schema = 'public' and table_name = 'entitlements' and grantee = 'authenticated'),
  array['SELECT'],
  'authenticated holds select on entitlements and nothing else'
);
select is(
  (select array_agg(privilege_type::text order by privilege_type::text) from information_schema.table_privileges
    where table_schema = 'public' and table_name = 'entitlements' and grantee = 'service_role'),
  array['DELETE', 'INSERT', 'UPDATE'],
  'service_role holds insert, update and delete on entitlements'
);
select ok(
  not has_any_column_privilege('authenticated', 'public.entitlements', 'insert')
    and not has_any_column_privilege('authenticated', 'public.entitlements', 'update')
    and not has_any_column_privilege('authenticated', 'public.entitlements', 'references')
    and not has_any_column_privilege('service_role', 'public.entitlements', 'references'),
  'no client holds a column level write or references privilege on entitlements'
);

-- Functions: shape and privileges.
select is_definer('public', 'assistant_access', array['uuid'], 'assistant_access(uuid) is security definer');
select is_definer('public', 'has_entitlement', array['uuid', 'text'], 'has_entitlement(uuid, text) is security definer');
select is(
  (select proconfig from pg_proc where oid = 'public.assistant_access(uuid)'::regprocedure),
  array['search_path=""'],
  'assistant_access(uuid) runs with an empty search_path'
);
select is(
  (select proconfig from pg_proc where oid = 'public.has_entitlement(uuid, text)'::regprocedure),
  array['search_path=""'],
  'has_entitlement(uuid, text) runs with an empty search_path'
);
select function_returns('public', 'assistant_access', array['uuid'], 'setof record', 'assistant_access(uuid) returns a table');
select function_returns('public', 'has_entitlement', array['uuid', 'text'], 'boolean', 'has_entitlement(uuid, text) returns a boolean');
select function_privs_are('public', 'assistant_access', array['uuid'], 'anon', array[]::text[], 'anon cannot execute assistant_access');
select function_privs_are('public', 'assistant_access', array['uuid'], 'authenticated', array[]::text[], 'authenticated cannot execute assistant_access');
select function_privs_are('public', 'assistant_access', array['uuid'], 'service_role', array['EXECUTE'], 'service_role can execute assistant_access');
select function_privs_are('public', 'has_entitlement', array['uuid', 'text'], 'anon', array[]::text[], 'anon cannot execute has_entitlement');
select function_privs_are('public', 'has_entitlement', array['uuid', 'text'], 'authenticated', array[]::text[], 'authenticated cannot execute has_entitlement');
select function_privs_are('public', 'has_entitlement', array['uuid', 'text'], 'service_role', array['EXECUTE'], 'service_role can execute has_entitlement');
select is(
  (select count(*)::int
    from pg_proc as function_row, aclexplode(function_row.proacl) as privilege
    where function_row.oid in ('public.assistant_access(uuid)'::regprocedure, 'public.has_entitlement(uuid, text)'::regprocedure)
      and privilege.grantee = 0),
  0,
  'the public pseudo role holds no execute privilege on either function'
);

-- assistant_access, read by the service role as the assistant function does. The service role has no
-- select on entitlements, so these also prove the function reads the table with its owner's rights.
set local role service_role;

select results_eq(
  $$select plan, daily_turns, source from public.assistant_access('66600000-0000-4000-8000-0000000000aa')$$,
  $$values ('free'::text, 15, 'default'::text)$$,
  'a user with no row gets the free plan, 15 turns a day, from the default'
);
select results_eq(
  $$select plan, daily_turns, source from public.assistant_access('66600000-0000-4000-8000-0000000000bb')$$,
  $$values ('plus'::text, 30, 'manual'::text)$$,
  'a plus row with a future expiry wins and returns its own limit'
);
select results_eq(
  $$select plan, daily_turns, source from public.assistant_access('66600000-0000-4000-8000-0000000000cc')$$,
  $$values ('free'::text, 15, 'default'::text)$$,
  'an expired plus row falls back to the free default'
);
select results_eq(
  $$select plan, daily_turns, source from public.assistant_access('66600000-0000-4000-8000-0000000000a3')$$,
  $$values ('free'::text, 15, 'default'::text)$$,
  'a row that expires at this very instant is already expired'
);
select results_eq(
  $$select plan, daily_turns, source from public.assistant_access('66600000-0000-4000-8000-0000000000dd')$$,
  $$values ('unlimited'::text, null::integer, 'manual'::text)$$,
  'an unlimited row that never expires returns unlimited with no daily limit'
);
select results_eq(
  $$select plan, daily_turns, source from public.assistant_access('66600000-0000-4000-8000-0000000000ee')$$,
  $$values ('unlimited'::text, null::integer, 'manual'::text)$$,
  'an unlimited row returns no daily limit whatever its column holds'
);
select results_eq(
  $$select plan, daily_turns, source from public.assistant_access('66600000-0000-4000-8000-0000000000ff')$$,
  $$values ('free'::text, 15, 'default'::text)$$,
  'an expired unlimited row falls back to the free default'
);
select results_eq(
  $$select plan, daily_turns, source from public.assistant_access('66600000-0000-4000-8000-0000000000a1')$$,
  $$values ('plus'::text, 15, 'manual'::text)$$,
  'a plus row with no limit returns 15, so null never means unlimited by accident'
);
select results_eq(
  $$select plan, daily_turns, source from public.assistant_access('66600000-0000-4000-8000-0000000000a2')$$,
  $$values ('free'::text, 5, 'manual'::text)$$,
  'a free row with its own limit returns that limit'
);
select results_eq(
  $$select plan, daily_turns, source from public.assistant_access('66600000-0000-4000-8000-0000000000a4')$$,
  $$values ('free'::text, 15, 'default'::text)$$,
  'a user whose row was removed is back on the free default'
);

-- has_entitlement.
select ok(
  public.has_entitlement('66600000-0000-4000-8000-0000000000aa', 'assistant'),
  'has_entitlement is true for the free default'
);
select ok(
  public.has_entitlement('66600000-0000-4000-8000-0000000000bb', 'assistant'),
  'has_entitlement is true for a live plus row'
);
select ok(
  public.has_entitlement('66600000-0000-4000-8000-0000000000dd', 'assistant'),
  'has_entitlement is true for a live unlimited row'
);
select ok(
  public.has_entitlement('66600000-0000-4000-8000-0000000000cc', 'assistant'),
  'has_entitlement is true after a row expired, because the free default remains'
);
select ok(
  not public.has_entitlement('66600000-0000-4000-8000-0000000000aa', 'coaching'),
  'has_entitlement is false for a feature that has neither a row nor a default'
);

-- The service role inserts, as the grant says. It holds no select on the table, so an update or a delete
-- with a where clause is refused to it, and only the insert is exercised here.
select lives_ok(
  $$insert into public.entitlements (user_id, feature, plan, source) values ('66600000-0000-4000-8000-0000000000a4', 'assistant', 'unlimited', 'manual')$$,
  'the service role inserts an entitlement'
);

reset role;

select results_eq(
  $$select plan, daily_turns, source from public.assistant_access('66600000-0000-4000-8000-0000000000a4')$$,
  $$values ('unlimited'::text, null::integer, 'manual'::text)$$,
  'a row added takes effect on the next read, with no deploy'
);
delete from public.entitlements where user_id = '66600000-0000-4000-8000-0000000000a4';
select results_eq(
  $$select plan, daily_turns, source from public.assistant_access('66600000-0000-4000-8000-0000000000a4')$$,
  $$values ('free'::text, 15, 'default'::text)$$,
  'removing the row restores the free plan'
);

-- Clients: they read their own row and write nothing, and they cannot call either function.
set local role authenticated;
set local request.jwt.claims = '{"sub":"66600000-0000-4000-8000-0000000000bb","role":"authenticated"}';

select is(
  (select count(*)::int from public.entitlements),
  1,
  'a user reads exactly their own entitlement'
);
select is(
  (select plan from public.entitlements),
  'plus',
  'the row a user reads is their own'
);
select throws_ok(
  $$insert into public.entitlements (user_id, feature, plan, source) values ('66600000-0000-4000-8000-0000000000bb', 'assistant', 'unlimited', 'manual')$$,
  '42501',
  'permission denied for table entitlements',
  'a client cannot insert an entitlement'
);
select throws_ok(
  $$update public.entitlements set plan = 'unlimited'$$,
  '42501',
  'permission denied for table entitlements',
  'a client cannot raise its own plan'
);
select throws_ok(
  $$delete from public.entitlements$$,
  '42501',
  'permission denied for table entitlements',
  'a client cannot delete an entitlement'
);
select throws_ok(
  $$select * from public.assistant_access('66600000-0000-4000-8000-0000000000bb')$$,
  '42501',
  'permission denied for function assistant_access',
  'a client cannot call assistant_access'
);
select throws_ok(
  $$select public.has_entitlement('66600000-0000-4000-8000-0000000000bb', 'assistant')$$,
  '42501',
  'permission denied for function has_entitlement',
  'a client cannot call has_entitlement'
);

set local request.jwt.claims = '{"sub":"66600000-0000-4000-8000-0000000000aa","role":"authenticated"}';
select is(
  (select count(*)::int from public.entitlements),
  0,
  'a user with no entitlement reads no row, and never another user''s'
);

reset role;

set local role anon;
select throws_ok(
  $$select count(*) from public.entitlements$$,
  '42501',
  'permission denied for table entitlements',
  'anon cannot read entitlements'
);
select throws_ok(
  $$select * from public.assistant_access('66600000-0000-4000-8000-0000000000bb')$$,
  '42501',
  'permission denied for function assistant_access',
  'anon cannot call assistant_access'
);
reset role;

-- The cascade from the auth user.
select is(
  (select count(*)::int from public.entitlements where user_id = '66600000-0000-4000-8000-0000000000a5'),
  1,
  'the user to be deleted has an entitlement'
);
delete from auth.users where id = '66600000-0000-4000-8000-0000000000a5';
select is(
  (select count(*)::int from public.entitlements where user_id = '66600000-0000-4000-8000-0000000000a5'),
  0,
  'deleting the auth user deletes their entitlement'
);

-- The consent columns.
select has_column('public', 'profiles', 'assistant_consent_at', 'profiles has assistant_consent_at');
select has_column('public', 'profiles', 'assistant_consent_version', 'profiles has assistant_consent_version');
select col_type_is('public', 'profiles', 'assistant_consent_at', 'timestamp with time zone', 'assistant_consent_at is a timestamptz');
select col_type_is('public', 'profiles', 'assistant_consent_version', 'text', 'assistant_consent_version is text');
select col_is_null('public', 'profiles', 'assistant_consent_at', 'assistant_consent_at is nullable');
select col_is_null('public', 'profiles', 'assistant_consent_version', 'assistant_consent_version is nullable');
select col_hasnt_default('public', 'profiles', 'assistant_consent_at', 'assistant_consent_at has no default');
select col_hasnt_default('public', 'profiles', 'assistant_consent_version', 'assistant_consent_version has no default');
select ok(
  has_column_privilege('authenticated', 'public.profiles', 'assistant_consent_at', 'update')
    and has_column_privilege('authenticated', 'public.profiles', 'assistant_consent_version', 'update'),
  'authenticated can update both consent columns'
);
select ok(
  not has_column_privilege('authenticated', 'public.profiles', 'assistant_consent_at', 'insert')
    and not has_column_privilege('authenticated', 'public.profiles', 'assistant_consent_version', 'insert'),
  'authenticated cannot insert either consent column, because the sign-up trigger creates the row with both null'
);
select ok(
  has_column_privilege('authenticated', 'public.profiles', 'assistant_consent_at', 'select')
    and has_column_privilege('authenticated', 'public.profiles', 'assistant_consent_version', 'select'),
  'authenticated can read both consent columns'
);
select ok(
  not has_column_privilege('anon', 'public.profiles', 'assistant_consent_at', 'select')
    and not has_column_privilege('anon', 'public.profiles', 'assistant_consent_at', 'update')
    and not has_column_privilege('anon', 'public.profiles', 'assistant_consent_version', 'select')
    and not has_column_privilege('anon', 'public.profiles', 'assistant_consent_version', 'update'),
  'anon holds no privilege on the consent columns'
);
select ok(
  not has_column_privilege('authenticated', 'public.profiles', 'terms_accepted_at', 'update')
    and not has_column_privilege('authenticated', 'public.profiles', 'terms_version', 'update'),
  'the terms columns stay unwritable by authenticated'
);

-- Consent, as user A writes it.
set local role authenticated;
set local request.jwt.claims = '{"sub":"66600000-0000-4000-8000-0000000000aa","role":"authenticated"}';

select throws_ok(
  $$update public.profiles set assistant_consent_at = now()$$,
  '23514',
  'new row for relation "profiles" violates check constraint "profiles_assistant_consent_paired"',
  'a consent time without a version is refused'
);
select throws_ok(
  $$update public.profiles set assistant_consent_version = '1'$$,
  '23514',
  'new row for relation "profiles" violates check constraint "profiles_assistant_consent_paired"',
  'a consent version without a time is refused'
);
select is(
  pg_temp.affected_rows($$update public.profiles set assistant_consent_at = '2026-10-26T09:00:00Z', assistant_consent_version = '2026-10-15'$$),
  1::bigint,
  'the owner sets both consent columns on their own profile'
);
select results_eq(
  $$select assistant_consent_at, assistant_consent_version from public.profiles$$,
  $$values ('2026-10-26T09:00:00Z'::timestamptz, '2026-10-15'::text)$$,
  'both consent values are stored as sent'
);

-- User B cannot set or clear A's consent: the update matches no row.
set local request.jwt.claims = '{"sub":"66600000-0000-4000-8000-0000000000bb","role":"authenticated"}';

select is(
  pg_temp.affected_rows($$update public.profiles set assistant_consent_at = null, assistant_consent_version = null where id = '66600000-0000-4000-8000-0000000000aa'$$),
  0::bigint,
  'user B cannot clear the consent of user A'
);
select is(
  pg_temp.affected_rows($$update public.profiles set assistant_consent_at = now(), assistant_consent_version = 'b-says' where id = '66600000-0000-4000-8000-0000000000aa'$$),
  0::bigint,
  'user B cannot set the consent of user A'
);
select results_eq(
  $$select assistant_consent_at, assistant_consent_version from public.profiles$$,
  $$values (null::timestamptz, null::text)$$,
  'user B sees only their own profile, still with no consent'
);

set local request.jwt.claims = '{"sub":"66600000-0000-4000-8000-0000000000aa","role":"authenticated"}';
select results_eq(
  $$select assistant_consent_at, assistant_consent_version from public.profiles$$,
  $$values ('2026-10-26T09:00:00Z'::timestamptz, '2026-10-15'::text)$$,
  'the consent of user A is untouched by user B'
);
select is(
  pg_temp.affected_rows($$update public.profiles set assistant_consent_at = null, assistant_consent_version = null$$),
  1::bigint,
  'the owner clears both consent columns to switch the assistant off'
);
select results_eq(
  $$select assistant_consent_at, assistant_consent_version from public.profiles$$,
  $$values (null::timestamptz, null::text)$$,
  'both consent columns are null again'
);

reset role;

-- recipes.source_url.
select has_column('public', 'recipes', 'source_url', 'recipes has source_url');
select col_type_is('public', 'recipes', 'source_url', 'text', 'source_url is text');
select col_is_null('public', 'recipes', 'source_url', 'source_url is nullable');
select col_hasnt_default('public', 'recipes', 'source_url', 'source_url has no default');
select ok(
  has_column_privilege('authenticated', 'public.recipes', 'source_url', 'insert')
    and has_column_privilege('authenticated', 'public.recipes', 'source_url', 'update')
    and has_column_privilege('authenticated', 'public.recipes', 'source_url', 'select'),
  'authenticated can insert, update and read source_url'
);
select ok(
  not has_column_privilege('anon', 'public.recipes', 'source_url', 'select')
    and not has_column_privilege('anon', 'public.recipes', 'source_url', 'insert')
    and not has_column_privilege('anon', 'public.recipes', 'source_url', 'update')
    and not has_column_privilege('service_role', 'public.recipes', 'source_url', 'select'),
  'anon and service_role hold no privilege on source_url'
);

-- The column check, through a direct insert as user A.
set local role authenticated;
set local request.jwt.claims = '{"sub":"66600000-0000-4000-8000-0000000000aa","role":"authenticated"}';

select lives_ok(
  $$insert into public.recipes (name, servings, computed, source_url) values ('key666-direct-https', 1, '{}', 'https://example.com/pie')$$,
  'an https link is accepted by the column'
);
select lives_ok(
  $$insert into public.recipes (name, servings, computed, source_url) values ('key666-direct-http', 1, '{}', 'http://example.com/pie')$$,
  'an http link is accepted by the column'
);
select lives_ok(
  $$insert into public.recipes (name, servings, computed, source_url) values ('key666-direct-null', 1, '{}', null)$$,
  'no link is accepted by the column'
);
select throws_ok(
  $$insert into public.recipes (name, servings, computed, source_url) values ('key666-direct-script', 1, '{}', 'javascript:alert(1)')$$,
  '23514',
  'new row for relation "recipes" violates check constraint "recipes_source_url_check"',
  'a javascript: link is refused by the column'
);
select throws_ok(
  $$insert into public.recipes (name, servings, computed, source_url) values ('key666-direct-ftp', 1, '{}', 'ftp://example.com/pie')$$,
  '23514',
  'new row for relation "recipes" violates check constraint "recipes_source_url_check"',
  'an ftp link is refused by the column'
);
select throws_ok(
  $$insert into public.recipes (name, servings, computed, source_url) values ('key666-direct-bare', 1, '{}', 'example.com/pie')$$,
  '23514',
  'new row for relation "recipes" violates check constraint "recipes_source_url_check"',
  'a link with no scheme is refused by the column'
);
select throws_ok(
  $$insert into public.recipes (name, servings, computed, source_url) values ('key666-direct-anchor', 1, '{}', 'javascript:alert(1)//https://example.com')$$,
  '23514',
  'new row for relation "recipes" violates check constraint "recipes_source_url_check"',
  'a javascript: link that contains an https address further on is refused by the column, so the pattern is anchored'
);
select throws_ok(
  $$insert into public.recipes (name, servings, computed, source_url) values ('key666-direct-empty', 1, '{}', '')$$,
  '23514',
  'new row for relation "recipes" violates check constraint "recipes_source_url_check"',
  'an empty link is refused by the column'
);

-- save_recipe, create.
select lives_ok(
  $$ select set_config('key666.with_link', public.save_recipe(
       null, pg_temp.recipe('key666-with-link') || '{"source_url":"https://example.com/stew"}', '[]'
     )::text, true) $$,
  'a recipe is created with a source_url'
);
select is(
  (select source_url from public.recipes where id = current_setting('key666.with_link')::uuid),
  'https://example.com/stew',
  'create with source_url stores it'
);
select lives_ok(
  $$ select set_config('key666.no_link', public.save_recipe(null, pg_temp.recipe('key666-no-link'), '[]')::text, true) $$,
  'a recipe is created with no source_url key'
);
select is(
  (select source_url from public.recipes where id = current_setting('key666.no_link')::uuid),
  null,
  'create without source_url stores null'
);
select lives_ok(
  $$ select set_config('key666.null_link', public.save_recipe(
       null, pg_temp.recipe('key666-null-link') || '{"source_url":null}', '[]'
     )::text, true) $$,
  'a recipe is created with an explicit null source_url'
);
select is(
  (select source_url from public.recipes where id = current_setting('key666.null_link')::uuid),
  null,
  'create with a null source_url means no link'
);

-- save_recipe, update.
select lives_ok(
  $$ select public.save_recipe(
       current_setting('key666.with_link')::uuid, pg_temp.recipe('key666-with-link-renamed'), '[]'
     ) $$,
  'a recipe with a link is updated with no source_url key'
);
select results_eq(
  $$select name, source_url from public.recipes where id = current_setting('key666.with_link')::uuid$$,
  $$values ('key666-with-link-renamed'::text, 'https://example.com/stew'::text)$$,
  'update without the key keeps the stored link and still changes the name'
);
select lives_ok(
  $$ select public.save_recipe(
       current_setting('key666.with_link')::uuid, pg_temp.recipe('key666-with-link-renamed') || '{"source_url":"https://example.com/stew-v2"}', '[]'
     ) $$,
  'a recipe is updated with a new https source_url'
);
select is(
  (select source_url from public.recipes where id = current_setting('key666.with_link')::uuid),
  'https://example.com/stew-v2',
  'update with a new link replaces it'
);
select lives_ok(
  $$ select public.save_recipe(
       current_setting('key666.with_link')::uuid, pg_temp.recipe('key666-with-link-renamed') || '{"source_url":null}', '[]'
     ) $$,
  'a recipe is updated with an explicit null source_url'
);
select is(
  (select source_url from public.recipes where id = current_setting('key666.with_link')::uuid),
  null,
  'update with an explicit null clears the link'
);
select lives_ok(
  $$ select public.save_recipe(
       current_setting('key666.no_link')::uuid, pg_temp.recipe('key666-no-link') || '{"source_url":"http://example.com/soup"}', '[]'
     ) $$,
  'a recipe with no link is updated with an http source_url'
);
select is(
  (select source_url from public.recipes where id = current_setting('key666.no_link')::uuid),
  'http://example.com/soup',
  'update can add a link to a recipe that had none'
);

-- save_recipe, refusals. A refused save writes nothing.
select throws_ok(
  $$ select public.save_recipe(null, pg_temp.recipe('key666-refused-script') || '{"source_url":"javascript:alert(1)"}', '[]') $$,
  '22023',
  'the source link must start with http:// or https://',
  'create with a javascript: link is refused'
);
select throws_ok(
  $$ select public.save_recipe(null, pg_temp.recipe('key666-refused-anchor') || '{"source_url":"javascript:alert(1)//https://example.com"}', '[]') $$,
  '22023',
  'the source link must start with http:// or https://',
  'create with a javascript: link that contains an https address further on is refused, so the pattern is anchored'
);
select throws_ok(
  $$ select public.save_recipe(null, pg_temp.recipe('key666-refused-empty') || '{"source_url":""}', '[]') $$,
  '22023',
  'the source link must start with http:// or https://',
  'create with an empty link is refused'
);
select throws_ok(
  $$ select public.save_recipe(null, pg_temp.recipe('key666-refused-number') || '{"source_url":5}', '[]') $$,
  '22023',
  'the source link must be text or null',
  'create with a link that is not text is refused'
);
select is(
  (select count(*)::int from public.recipes where name like 'key666-refused-%'),
  0,
  'no refused create wrote a recipe'
);
select throws_ok(
  $$ select public.save_recipe(
       current_setting('key666.no_link')::uuid, pg_temp.recipe('key666-no-link') || '{"source_url":"javascript:alert(1)"}', '[]'
     ) $$,
  '22023',
  'the source link must start with http:// or https://',
  'update with a javascript: link is refused'
);
select is(
  (select source_url from public.recipes where id = current_setting('key666.no_link')::uuid),
  'http://example.com/soup',
  'a refused update leaves the stored link as it was'
);

-- User B cannot set the link on A's recipe, directly or through save_recipe.
select set_config('key666.a_recipe', current_setting('key666.no_link'), true);

set local request.jwt.claims = '{"sub":"66600000-0000-4000-8000-0000000000bb","role":"authenticated"}';

select is(
  pg_temp.affected_rows($$update public.recipes set source_url = 'https://example.com/b-was-here' where id = current_setting('key666.a_recipe')::uuid$$),
  0::bigint,
  'user B cannot set source_url on the recipe of user A with an update'
);
select throws_ok(
  $$ select public.save_recipe(
       current_setting('key666.a_recipe')::uuid, pg_temp.recipe('key666-b-takeover') || '{"source_url":"https://example.com/b-was-here"}', '[]'
     ) $$,
  'P0002',
  'the recipe does not exist or is not yours',
  'user B cannot set source_url on the recipe of user A through save_recipe'
);

reset role;

select results_eq(
  $$select name, source_url from public.recipes where id = current_setting('key666.a_recipe')::uuid$$,
  $$values ('key666-no-link'::text, 'http://example.com/soup'::text)$$,
  'the recipe of user A is unchanged by user B'
);

select * from finish();

rollback;
