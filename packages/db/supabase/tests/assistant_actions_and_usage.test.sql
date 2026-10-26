-- Asserts public.assistant_actions, public.assistant_usage, the view public.assistant_usage_daily and the
-- function public.assistant_spend_this_month() (ADR 0003, Amendment 14, and ADR 0006): the columns, the
-- checks, the keys, the indexes, the privileges, the owner-only policies, the ten slots of a turn, what a
-- deleted conversation leaves behind, the view's scope and sums, the month's spend and the cascade from
-- the auth user.
--
-- `supabase test db` runs this file as postgres inside a transaction that is rolled back, so nothing
-- created here persists. Every fixture id starts with 66500000 and every email with key665-. Each actor
-- is entered with `set local role` plus the JWT claims that `auth.uid()` reads, and left with
-- `reset role`.
--
-- An action holds ids and one date, and a usage row holds counts. Neither holds a health value, and the
-- fixtures are made up: tool names and model ids are plain words, and every count is a small number.
-- Every row is found by its id or its owner, never by a whole-table count, because the shared database
-- can hold other rows. The month's spend is compared with a baseline read just before the test's own
-- rows go in, for the same reason.
--
-- Fixture users: a and b (row level security, the client refusals, the view and the conversation delete),
-- c (the cascade from the auth user), d (the checks, the service role and the month's spend).

begin;

select plan(161);

insert into auth.users (instance_id, id, aud, role, email) values
  ('00000000-0000-0000-0000-000000000000', '66500000-0000-4000-8000-0000000000aa', 'authenticated', 'authenticated', 'key665-actions-a@keylow.test'),
  ('00000000-0000-0000-0000-000000000000', '66500000-0000-4000-8000-0000000000bb', 'authenticated', 'authenticated', 'key665-actions-b@keylow.test'),
  ('00000000-0000-0000-0000-000000000000', '66500000-0000-4000-8000-0000000000cc', 'authenticated', 'authenticated', 'key665-actions-c@keylow.test'),
  ('00000000-0000-0000-0000-000000000000', '66500000-0000-4000-8000-0000000000dd', 'authenticated', 'authenticated', 'key665-actions-d@keylow.test');

-- One conversation and one turn with ids the case chooses. They run as whoever calls them, postgres in
-- the cases below, so it is the table's constraints that decide and not its grants.
create function pg_temp.add_conversation(owner uuid, conversation uuid)
returns void
language sql
as $$
  insert into public.assistant_conversations (id, user_id) values (conversation, owner)
$$;

create function pg_temp.add_turn(owner uuid, conversation uuid, turn uuid)
returns void
language sql
as $$
  insert into public.assistant_turns (id, conversation_id, user_id, user_message_id)
  values (turn, conversation, owner, gen_random_uuid())
$$;

-- One action. With no target given it is a reserved slot. The conversation is the turn's own, unless the
-- case passes none.
create function pg_temp.add_action(
  owner uuid,
  conversation uuid,
  turn uuid,
  slot integer,
  action_tool text default 'log_entry',
  action_table text default 'food_log_entries',
  single_target uuid default null,
  many_targets uuid[] default null,
  target_day date default null
)
returns void
language sql
as $$
  insert into public.assistant_actions (
    user_id, conversation_id, turn_id, turn_seq, tool, target_table, target_id, target_ids, target_local_date
  )
  values (owner, conversation, turn, slot, action_tool, action_table, single_target, many_targets, target_day)
$$;

-- One usage row. The transport follows the route unless the case passes one, as the function that writes
-- it does. Every count is zero unless the case passes one.
create function pg_temp.add_usage(
  owner uuid,
  turn uuid,
  usage_route text default 'describe_or_ask',
  usage_transport text default null,
  usage_time timestamptz default now(),
  input_count integer default 0,
  output_count integer default 0,
  cache_read_count integer default 0,
  cache_creation_count integer default 0,
  cost bigint default 0,
  latency integer default 0,
  stop text default null
)
returns void
language sql
as $$
  insert into public.assistant_usage (
    user_id, turn_id, route, model, input_tokens, output_tokens, cache_read_input_tokens,
    cache_creation_input_tokens, cost_usd_micros, latency_ms, stop_reason, transport, created_at
  )
  values (
    owner, turn, usage_route, 'test-model', input_count, output_count, cache_read_count,
    cache_creation_count, cost, latency, stop,
    coalesce(usage_transport, case usage_route when 'describe_or_ask' then 'mcp_http' else 'none' end),
    usage_time
  )
$$;

-- The number of rows a statement affected, for the cases where row level security makes a delete match
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

-- The first instant of the current UTC month, the way the function under test reads it.
create function pg_temp.utc_month_start()
returns timestamptz
language sql
as $$
  select date_trunc('month', now() at time zone 'utc') at time zone 'utc'
$$;

-- Shape: assistant_actions.
select has_table('public', 'assistant_actions', 'assistant_actions exists');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.assistant_actions'::regclass),
  'row level security is enabled on assistant_actions'
);
select is(
  (select array_agg(
      column_name || ' ' || data_type || case when is_nullable = 'NO' then ' not null' else '' end
        || coalesce(' default ' || column_default, '')
      order by ordinal_position
    )
    from information_schema.columns where table_schema = 'public' and table_name = 'assistant_actions'),
  array[
    'id uuid not null default gen_random_uuid()',
    'user_id uuid not null',
    'conversation_id uuid',
    'turn_id uuid',
    'turn_seq integer not null',
    'tool text not null',
    'target_table text not null',
    'target_id uuid',
    'target_ids ARRAY',
    'target_local_date date',
    'target_updated_at timestamp with time zone',
    'created_at timestamp with time zone not null default now()',
    'undone_at timestamp with time zone'
  ],
  'assistant_actions has the amendment''s columns, types, nullability and defaults'
);
select is(
  (select udt_name::text from information_schema.columns
    where table_schema = 'public' and table_name = 'assistant_actions' and column_name = 'target_ids'),
  '_uuid',
  'target_ids is an array of uuid'
);
select is(
  (select array_agg(column_name::text order by column_name) from information_schema.columns
    where table_schema = 'public' and table_name = 'assistant_actions'
      and data_type in ('text', 'character varying', 'jsonb', 'json', 'numeric', 'real', 'double precision', 'integer', 'bigint', 'smallint')),
  array['target_table', 'tool', 'turn_seq'],
  'the only text or number columns of assistant_actions are the tool, the table name and the slot, so none can hold a nutrient, a weight or free text'
);
select col_is_pk('public', 'assistant_actions', 'id', 'the primary key is id');
select fk_ok('public', 'assistant_actions', 'user_id', 'auth', 'users', 'id', 'user_id references auth.users');
select is(
  (select confdeltype::text from pg_constraint where conrelid = 'public.assistant_actions'::regclass and conname = 'assistant_actions_user_id_fkey'),
  'c',
  'the user_id foreign key cascades on delete'
);
select fk_ok(
  'public', 'assistant_actions', 'conversation_id', 'public', 'assistant_conversations', 'id',
  'conversation_id references assistant_conversations'
);
select is(
  (select confdeltype::text from pg_constraint where conrelid = 'public.assistant_actions'::regclass and conname = 'assistant_actions_conversation_id_fkey'),
  'n',
  'the conversation_id foreign key sets null on delete'
);
select fk_ok('public', 'assistant_actions', 'turn_id', 'public', 'assistant_turns', 'id', 'turn_id references assistant_turns');
select is(
  (select confdeltype::text from pg_constraint where conrelid = 'public.assistant_actions'::regclass and conname = 'assistant_actions_turn_id_fkey'),
  'n',
  'the turn_id foreign key sets null on delete'
);
select is(
  (select count(*)::int from pg_constraint where conrelid = 'public.assistant_actions'::regclass and contype = 'f'),
  3,
  'target_id has no foreign key, so the only foreign keys are user_id, conversation_id and turn_id'
);
select is(
  (select count(*)::int from pg_trigger where tgrelid = 'public.assistant_actions'::regclass and not tgisinternal),
  0,
  'assistant_actions has no trigger'
);
select is(
  (select pg_get_constraintdef(oid) from pg_constraint
    where conrelid = 'public.assistant_actions'::regclass and conname = 'assistant_actions_turn_seq_check'),
  'CHECK (((turn_seq >= 1) AND (turn_seq <= 10)))',
  'the slot is checked to be from 1 to 10'
);
select is(
  (select pg_get_constraintdef(oid) from pg_constraint
    where conrelid = 'public.assistant_actions'::regclass and conname = 'assistant_actions_turn_id_turn_seq_key'),
  'UNIQUE (turn_id, turn_seq)',
  'a slot is unique within its turn'
);

-- Shape: assistant_usage.
select has_table('public', 'assistant_usage', 'assistant_usage exists');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.assistant_usage'::regclass),
  'row level security is enabled on assistant_usage'
);
select is(
  (select array_agg(
      column_name || ' ' || data_type || case when is_nullable = 'NO' then ' not null' else '' end
        || coalesce(' default ' || column_default, '')
      order by ordinal_position
    )
    from information_schema.columns where table_schema = 'public' and table_name = 'assistant_usage'),
  array[
    'id uuid not null default gen_random_uuid()',
    'user_id uuid not null',
    'turn_id uuid not null',
    'route text not null',
    'model text not null',
    'input_tokens integer not null',
    'output_tokens integer not null',
    'cache_read_input_tokens integer not null',
    'cache_creation_input_tokens integer not null',
    'cost_usd_micros bigint not null',
    'latency_ms integer not null',
    'stop_reason text',
    'transport text not null',
    'created_at timestamp with time zone not null default now()'
  ],
  'assistant_usage has the amendment''s columns, types, nullability and defaults'
);
select is(
  (select array_agg(column_name::text order by column_name) from information_schema.columns
    where table_schema = 'public' and table_name = 'assistant_usage'
      and data_type in ('text', 'character varying', 'jsonb', 'json', 'numeric', 'real', 'double precision', 'ARRAY')),
  array['model', 'route', 'stop_reason', 'transport'],
  'the only text columns of assistant_usage are the route, the model id, the stop reason and the transport, and it has no json, array or decimal column'
);
select col_is_pk('public', 'assistant_usage', 'id', 'the primary key is id');
select fk_ok('public', 'assistant_usage', 'user_id', 'auth', 'users', 'id', 'user_id references auth.users');
select is(
  (select confdeltype::text from pg_constraint where conrelid = 'public.assistant_usage'::regclass and conname = 'assistant_usage_user_id_fkey'),
  'c',
  'the user_id foreign key cascades on delete'
);
select is(
  (select count(*)::int from pg_constraint where conrelid = 'public.assistant_usage'::regclass and contype = 'f'),
  1,
  'turn_id has no foreign key, so the only foreign key is user_id and deleting a conversation never lowers the spend'
);
select is(
  (select count(*)::int from pg_trigger where tgrelid = 'public.assistant_usage'::regclass and not tgisinternal),
  0,
  'assistant_usage has no trigger'
);

-- Shape: the view.
select has_view('public', 'assistant_usage_daily', 'assistant_usage_daily exists');
select is(
  (select array_agg(column_name || ' ' || data_type order by ordinal_position)
    from information_schema.columns where table_schema = 'public' and table_name = 'assistant_usage_daily'),
  array[
    'user_id uuid',
    'usage_date date',
    'turns bigint',
    'input_tokens bigint',
    'output_tokens bigint',
    'cache_read_input_tokens bigint',
    'cache_creation_input_tokens bigint',
    'cost_usd_micros bigint'
  ],
  'assistant_usage_daily has the amendment''s columns and types'
);
select ok(
  (select coalesce(reloptions @> array['security_invoker=true'], false) from pg_class where oid = 'public.assistant_usage_daily'::regclass),
  'assistant_usage_daily is a security_invoker view'
);

-- Shape: the function.
select has_function('public', 'assistant_spend_this_month', array[]::text[], 'assistant_spend_this_month() exists');
select function_returns('public', 'assistant_spend_this_month', array[]::text[], 'bigint', 'assistant_spend_this_month() returns bigint');
select is_definer('public', 'assistant_spend_this_month', array[]::text[], 'assistant_spend_this_month() is security definer');
select is(
  (select proconfig from pg_proc where oid = 'public.assistant_spend_this_month()'::regprocedure),
  array['search_path=""'],
  'assistant_spend_this_month() runs with an empty search_path'
);

-- Indexes. Each table has its primary key, the indexes the amendment names and no other.
select is(
  (select array_agg(indexname::text order by indexname) from pg_indexes where schemaname = 'public' and tablename = 'assistant_actions'),
  array[
    'assistant_actions_conversation_id_idx', 'assistant_actions_pkey', 'assistant_actions_turn_id_turn_seq_key',
    'assistant_actions_user_id_created_at_idx'
  ],
  'assistant_actions has the primary key, the unique slot key, the conversation_id index and the user_id and created_at index and no other index'
);
select is(
  (select indexdef from pg_indexes where schemaname = 'public' and indexname = 'assistant_actions_turn_id_turn_seq_key'),
  'CREATE UNIQUE INDEX assistant_actions_turn_id_turn_seq_key ON public.assistant_actions USING btree (turn_id, turn_seq)',
  'the unique key is on turn_id and turn_seq, so it serves the turn_id foreign key'
);
select is(
  (select indexdef from pg_indexes where schemaname = 'public' and indexname = 'assistant_actions_user_id_created_at_idx'),
  'CREATE INDEX assistant_actions_user_id_created_at_idx ON public.assistant_actions USING btree (user_id, created_at DESC)',
  'the changes list index is on user_id and created_at descending, and serves the cascade from auth.users'
);
select is(
  (select indexdef from pg_indexes where schemaname = 'public' and indexname = 'assistant_actions_conversation_id_idx'),
  'CREATE INDEX assistant_actions_conversation_id_idx ON public.assistant_actions USING btree (conversation_id)',
  'the actions conversation_id index is on conversation_id, for the set null'
);
select is(
  (select array_agg(indexname::text order by indexname) from pg_indexes where schemaname = 'public' and tablename = 'assistant_usage'),
  array['assistant_usage_created_at_idx', 'assistant_usage_pkey', 'assistant_usage_user_id_created_at_idx'],
  'assistant_usage has the primary key, the created_at index and the user_id and created_at index and no other index'
);
select is(
  (select indexdef from pg_indexes where schemaname = 'public' and indexname = 'assistant_usage_user_id_created_at_idx'),
  'CREATE INDEX assistant_usage_user_id_created_at_idx ON public.assistant_usage USING btree (user_id, created_at)',
  'the usage index is on user_id and created_at, for the daily view and the cascade from auth.users'
);
select is(
  (select indexdef from pg_indexes where schemaname = 'public' and indexname = 'assistant_usage_created_at_idx'),
  'CREATE INDEX assistant_usage_created_at_idx ON public.assistant_usage USING btree (created_at)',
  'the usage created_at index is on created_at, for the monthly sum'
);

-- Policies, read from the catalog. Each table has one select policy for the owner and nothing else.
select policies_are('public', 'assistant_actions', array['assistant_actions_select_own'], 'assistant_actions has exactly one policy');
select policy_cmd_is('public', 'assistant_actions', 'assistant_actions_select_own', 'select', 'assistant_actions_select_own is for select');
select policy_roles_are('public', 'assistant_actions', 'assistant_actions_select_own', array['authenticated'], 'assistant_actions_select_own is for authenticated only');
select policies_are('public', 'assistant_usage', array['assistant_usage_select_own'], 'assistant_usage has exactly one policy');
select policy_cmd_is('public', 'assistant_usage', 'assistant_usage_select_own', 'select', 'assistant_usage_select_own is for select');
select policy_roles_are('public', 'assistant_usage', 'assistant_usage_select_own', array['authenticated'], 'assistant_usage_select_own is for authenticated only');
-- Each policy reads the caller as `(select auth.uid())`, which Postgres evaluates once per statement and
-- renders with the subselect. A bare `auth.uid()` would be evaluated once per row and shows no subselect.
select ok(
  (select qual from pg_policies where schemaname = 'public' and tablename = 'assistant_actions' and policyname = 'assistant_actions_select_own')
    like '%user_id = ( SELECT auth.uid()%',
  'assistant_actions_select_own tests user_id against (select auth.uid())'
);
select ok(
  (select qual from pg_policies where schemaname = 'public' and tablename = 'assistant_usage' and policyname = 'assistant_usage_select_own')
    like '%user_id = ( SELECT auth.uid()%',
  'assistant_usage_select_own tests user_id against (select auth.uid())'
);

-- Privileges, read from the catalog.
select is(
  (select array_agg(privilege_type::text order by privilege_type) from information_schema.table_privileges
    where table_schema = 'public' and table_name = 'assistant_actions' and grantee = 'authenticated'),
  array['SELECT'],
  'authenticated holds table level select on assistant_actions and nothing else'
);
select is(
  (select array_agg(privilege_type::text order by privilege_type) from information_schema.table_privileges
    where table_schema = 'public' and table_name = 'assistant_usage' and grantee = 'authenticated'),
  array['SELECT'],
  'authenticated holds table level select on assistant_usage and nothing else'
);
select is(
  (select array_agg(privilege_type::text order by privilege_type) from information_schema.table_privileges
    where table_schema = 'public' and table_name = 'assistant_actions' and grantee = 'service_role'),
  array['DELETE', 'INSERT', 'SELECT', 'UPDATE'],
  'service_role holds table level select, insert, update and delete on assistant_actions and nothing else'
);
select is(
  (select array_agg(privilege_type::text order by privilege_type) from information_schema.table_privileges
    where table_schema = 'public' and table_name = 'assistant_usage' and grantee = 'service_role'),
  array['INSERT'],
  'service_role holds table level insert on assistant_usage and nothing else'
);
select is(
  (select count(*)::int from information_schema.column_privileges
    where table_schema = 'public'
      and table_name in ('assistant_actions', 'assistant_usage')
      and grantee in ('authenticated', 'service_role')
      and privilege_type not in ('SELECT', 'INSERT', 'UPDATE', 'DELETE')),
  0,
  'no references privilege is held by authenticated or service_role on any column of the two tables'
);
select ok(
  not has_table_privilege('authenticated', 'public.assistant_actions', 'insert')
    and not has_table_privilege('authenticated', 'public.assistant_actions', 'update')
    and not has_table_privilege('authenticated', 'public.assistant_actions', 'delete')
    and not has_table_privilege('authenticated', 'public.assistant_actions', 'truncate')
    and not has_table_privilege('authenticated', 'public.assistant_actions', 'references')
    and not has_table_privilege('authenticated', 'public.assistant_actions', 'trigger')
    and not has_any_column_privilege('authenticated', 'public.assistant_actions', 'insert')
    and not has_any_column_privilege('authenticated', 'public.assistant_actions', 'update')
    and not has_any_column_privilege('authenticated', 'public.assistant_actions', 'references'),
  'authenticated has no write privilege of any kind on assistant_actions'
);
select ok(
  not has_table_privilege('authenticated', 'public.assistant_usage', 'insert')
    and not has_table_privilege('authenticated', 'public.assistant_usage', 'update')
    and not has_table_privilege('authenticated', 'public.assistant_usage', 'delete')
    and not has_table_privilege('authenticated', 'public.assistant_usage', 'truncate')
    and not has_table_privilege('authenticated', 'public.assistant_usage', 'references')
    and not has_table_privilege('authenticated', 'public.assistant_usage', 'trigger')
    and not has_any_column_privilege('authenticated', 'public.assistant_usage', 'insert')
    and not has_any_column_privilege('authenticated', 'public.assistant_usage', 'update')
    and not has_any_column_privilege('authenticated', 'public.assistant_usage', 'references'),
  'authenticated has no write privilege of any kind on assistant_usage'
);
select ok(
  not has_table_privilege('service_role', 'public.assistant_actions', 'truncate')
    and not has_table_privilege('service_role', 'public.assistant_actions', 'references')
    and not has_table_privilege('service_role', 'public.assistant_actions', 'trigger')
    and not has_table_privilege('service_role', 'public.assistant_usage', 'select')
    and not has_table_privilege('service_role', 'public.assistant_usage', 'update')
    and not has_table_privilege('service_role', 'public.assistant_usage', 'delete')
    and not has_table_privilege('service_role', 'public.assistant_usage', 'truncate')
    and not has_any_column_privilege('service_role', 'public.assistant_usage', 'select')
    and not has_any_column_privilege('service_role', 'public.assistant_usage', 'update'),
  'service_role cannot truncate actions, and cannot read, update or delete usage'
);
select ok(
  not has_table_privilege('anon', 'public.assistant_actions', 'select')
    and not has_table_privilege('anon', 'public.assistant_actions', 'insert')
    and not has_table_privilege('anon', 'public.assistant_actions', 'update')
    and not has_table_privilege('anon', 'public.assistant_actions', 'delete')
    and not has_any_column_privilege('anon', 'public.assistant_actions', 'select')
    and not has_any_column_privilege('anon', 'public.assistant_actions', 'insert')
    and not has_any_column_privilege('anon', 'public.assistant_actions', 'update'),
  'anon has no privilege on assistant_actions'
);
select ok(
  not has_table_privilege('anon', 'public.assistant_usage', 'select')
    and not has_table_privilege('anon', 'public.assistant_usage', 'insert')
    and not has_table_privilege('anon', 'public.assistant_usage', 'update')
    and not has_table_privilege('anon', 'public.assistant_usage', 'delete')
    and not has_any_column_privilege('anon', 'public.assistant_usage', 'select')
    and not has_any_column_privilege('anon', 'public.assistant_usage', 'insert')
    and not has_any_column_privilege('anon', 'public.assistant_usage', 'update'),
  'anon has no privilege on assistant_usage'
);
select is(
  (select array_agg(privilege.privilege_type order by privilege.privilege_type)
    from pg_class as view_class, aclexplode(view_class.relacl) as privilege
    where view_class.oid = 'public.assistant_usage_daily'::regclass
      and privilege.grantee = 'authenticated'::regrole),
  array['SELECT'],
  'authenticated holds select on assistant_usage_daily and nothing else'
);
select is(
  (select count(*)::int
    from pg_class as view_class, aclexplode(view_class.relacl) as privilege
    where view_class.oid = 'public.assistant_usage_daily'::regclass
      and privilege.grantee <> 'authenticated'::regrole
      and privilege.grantee <> view_class.relowner),
  0,
  'no role other than authenticated and the owner holds any privilege on assistant_usage_daily'
);
select function_privs_are('public', 'assistant_spend_this_month', array[]::text[], 'anon', array[]::text[], 'anon cannot execute assistant_spend_this_month');
select function_privs_are('public', 'assistant_spend_this_month', array[]::text[], 'authenticated', array[]::text[], 'authenticated cannot execute assistant_spend_this_month');
select function_privs_are('public', 'assistant_spend_this_month', array[]::text[], 'service_role', array['EXECUTE'], 'service_role can execute assistant_spend_this_month');
select ok(
  not exists (
    select 1 from pg_proc, aclexplode(proacl) as privilege
    where oid = 'public.assistant_spend_this_month()'::regprocedure and privilege.grantee = 0
  ),
  'PUBLIC holds no privilege on assistant_spend_this_month'
);

-- With no usage row at all the month's spend is 0 and not null. The delete runs as postgres inside this
-- transaction, which is rolled back, so the rows the shared database holds come back. It runs before any
-- fixture below is inserted.
delete from public.assistant_usage;

select is(
  public.assistant_spend_this_month(),
  0::bigint,
  'assistant_spend_this_month() returns 0 when there is no usage row'
);

-- Checks and keys, as postgres, on user D. One conversation and three turns carry the cases.
select lives_ok(
  $$select pg_temp.add_conversation('66500000-0000-4000-8000-0000000000dd', '66500000-0000-4000-8000-000000000d01')$$,
  'a conversation is accepted for the checks'
);
select lives_ok(
  $$select pg_temp.add_turn('66500000-0000-4000-8000-0000000000dd', '66500000-0000-4000-8000-000000000d01', '66500000-0000-4000-8000-000000000d11'),
    pg_temp.add_turn('66500000-0000-4000-8000-0000000000dd', '66500000-0000-4000-8000-000000000d01', '66500000-0000-4000-8000-000000000d12'),
    pg_temp.add_turn('66500000-0000-4000-8000-0000000000dd', '66500000-0000-4000-8000-000000000d01', '66500000-0000-4000-8000-000000000d13')$$,
  'three turns are accepted for the checks'
);

-- assistant_actions: the ten slots of a turn.
select lives_ok(
  $$select pg_temp.add_action('66500000-0000-4000-8000-0000000000dd', '66500000-0000-4000-8000-000000000d01', '66500000-0000-4000-8000-000000000d11', 1)$$,
  'a reserved slot, with no target of any kind, is accepted'
);
select lives_ok(
  $$select pg_temp.add_action('66500000-0000-4000-8000-0000000000dd', '66500000-0000-4000-8000-000000000d01', '66500000-0000-4000-8000-000000000d11', s)
    from generate_series(2, 10) as s$$,
  'slots 2 to 10 are accepted for the same turn'
);
select is(
  (select count(*)::int from public.assistant_actions where turn_id = '66500000-0000-4000-8000-000000000d11'),
  10,
  'a turn holds ten actions, one for each slot'
);
select throws_ok(
  $$select pg_temp.add_action('66500000-0000-4000-8000-0000000000dd', '66500000-0000-4000-8000-000000000d01', '66500000-0000-4000-8000-000000000d11', 11)$$,
  '23514',
  'new row for relation "assistant_actions" violates check constraint "assistant_actions_turn_seq_check"',
  'an eleventh action for one turn fails on the check'
);
select throws_ok(
  $$select pg_temp.add_action('66500000-0000-4000-8000-0000000000dd', '66500000-0000-4000-8000-000000000d01', '66500000-0000-4000-8000-000000000d12', 0)$$,
  '23514',
  'new row for relation "assistant_actions" violates check constraint "assistant_actions_turn_seq_check"',
  'slot 0 fails on the check'
);
select throws_ok(
  $$select pg_temp.add_action('66500000-0000-4000-8000-0000000000dd', '66500000-0000-4000-8000-000000000d01', '66500000-0000-4000-8000-000000000d11', 3)$$,
  '23505',
  'duplicate key value violates unique constraint "assistant_actions_turn_id_turn_seq_key"',
  'two actions with the same turn and slot fail on the unique constraint'
);
select lives_ok(
  $$select pg_temp.add_action('66500000-0000-4000-8000-0000000000dd', '66500000-0000-4000-8000-000000000d01', '66500000-0000-4000-8000-000000000d12', 3)$$,
  'the same slot on another turn is accepted'
);
select throws_ok(
  $$select pg_temp.add_action('66500000-0000-4000-8000-0000000000dd', null, null, null)$$,
  '23502',
  'null value in column "turn_seq" of relation "assistant_actions" violates not-null constraint',
  'an action with no slot is refused'
);
select lives_ok(
  $$select pg_temp.add_action('66500000-0000-4000-8000-0000000000dd', null, null, 1),
    pg_temp.add_action('66500000-0000-4000-8000-0000000000dd', null, null, 1)$$,
  'two actions with no turn can share a slot number, as the rows of deleted turns do'
);

-- assistant_actions: what a write names.
select lives_ok(
  $$select pg_temp.add_action('66500000-0000-4000-8000-0000000000dd', '66500000-0000-4000-8000-000000000d01', '66500000-0000-4000-8000-000000000d12', 4,
    'copy_day', 'food_log_entries', null,
    array['66500000-0000-4000-8000-000000000e01', '66500000-0000-4000-8000-000000000e02', '66500000-0000-4000-8000-000000000e03']::uuid[],
    '2026-10-20')$$,
  'an action that names several rows and a day is accepted'
);
select is(
  (select cardinality(target_ids) from public.assistant_actions
    where turn_id = '66500000-0000-4000-8000-000000000d12' and turn_seq = 4),
  3,
  'target_ids keeps the three ids'
);
select is(
  (select target_local_date from public.assistant_actions
    where turn_id = '66500000-0000-4000-8000-000000000d12' and turn_seq = 4),
  '2026-10-20'::date,
  'target_local_date keeps the day'
);
select lives_ok(
  $$select pg_temp.add_action('66500000-0000-4000-8000-0000000000dd', '66500000-0000-4000-8000-000000000d01', '66500000-0000-4000-8000-000000000d12', 5,
    'delete_entry', 'food_log_entries', null, array['66500000-0000-4000-8000-000000000e04']::uuid[])$$,
  'target_ids with a single id is accepted'
);
select lives_ok(
  $$select pg_temp.add_action('66500000-0000-4000-8000-0000000000dd', '66500000-0000-4000-8000-000000000d01', '66500000-0000-4000-8000-000000000d12', 6,
    'log_entry', 'food_log_entries', '66500000-0000-4000-8000-000000000e05')$$,
  'an action that names a single row is accepted'
);
select lives_ok(
  $$select pg_temp.add_action('66500000-0000-4000-8000-0000000000dd', '66500000-0000-4000-8000-000000000d01', '66500000-0000-4000-8000-000000000d12', 7,
    'set_day_complete', 'day_logs', null, null, '2026-10-20')$$,
  'an action that names only a day is accepted'
);
select throws_ok(
  $$select pg_temp.add_action('66500000-0000-4000-8000-0000000000dd', '66500000-0000-4000-8000-000000000d01', '66500000-0000-4000-8000-000000000d12', 8,
    'copy_day', 'food_log_entries', null, array[]::uuid[])$$,
  '23514',
  'new row for relation "assistant_actions" violates check constraint "assistant_actions_target_ids_check"',
  'an empty target_ids array fails on the check'
);
select throws_ok(
  $$select pg_temp.add_action('66500000-0000-4000-8000-0000000000dd', '66500000-0000-4000-8000-000000000d01', '66500000-0000-4000-8000-000000000d12', 8, null)$$,
  '23502',
  'null value in column "tool" of relation "assistant_actions" violates not-null constraint',
  'an action with no tool name is refused'
);
select throws_ok(
  $$select pg_temp.add_action('66500000-0000-4000-8000-0000000000dd', '66500000-0000-4000-8000-000000000d01', '66500000-0000-4000-8000-000000000d12', 8, 'log_entry', null)$$,
  '23502',
  'null value in column "target_table" of relation "assistant_actions" violates not-null constraint',
  'an action with no table name is refused'
);
select throws_ok(
  $$select pg_temp.add_action(gen_random_uuid(), null, null, 1)$$,
  '23503',
  'insert or update on table "assistant_actions" violates foreign key constraint "assistant_actions_user_id_fkey"',
  'an action for a user that does not exist is refused'
);
select throws_ok(
  $$select pg_temp.add_action('66500000-0000-4000-8000-0000000000dd', gen_random_uuid(), null, 1)$$,
  '23503',
  'insert or update on table "assistant_actions" violates foreign key constraint "assistant_actions_conversation_id_fkey"',
  'an action for a conversation that does not exist is refused'
);
select throws_ok(
  $$select pg_temp.add_action('66500000-0000-4000-8000-0000000000dd', null, gen_random_uuid(), 1)$$,
  '23503',
  'insert or update on table "assistant_actions" violates foreign key constraint "assistant_actions_turn_id_fkey"',
  'an action for a turn that does not exist is refused'
);

-- assistant_usage: the checks.
select lives_ok(
  $$select pg_temp.add_usage('66500000-0000-4000-8000-0000000000dd', '66500000-0000-4000-8000-000000000d11')$$,
  'a describe_or_ask row with every count zero is accepted'
);
select is(
  (select transport from public.assistant_usage
    where user_id = '66500000-0000-4000-8000-0000000000dd' and route = 'describe_or_ask' limit 1),
  'mcp_http',
  'a describe_or_ask row carries the mcp_http transport in the fixture'
);
select lives_ok(
  $$select pg_temp.add_usage('66500000-0000-4000-8000-0000000000dd', '66500000-0000-4000-8000-000000000d11', 'compact')$$,
  'a compact row with the none transport is accepted'
);
select lives_ok(
  $$select pg_temp.add_usage('66500000-0000-4000-8000-0000000000dd', '66500000-0000-4000-8000-000000000d11', 'recipe_parse')$$,
  'a recipe_parse row with the none transport is accepted'
);
select lives_ok(
  $$select pg_temp.add_usage('66500000-0000-4000-8000-0000000000dd', gen_random_uuid(), stop => 'end_turn')$$,
  'a row for a turn that does not exist, with a stop reason, is accepted because turn_id has no foreign key'
);
select throws_ok(
  $$select pg_temp.add_usage('66500000-0000-4000-8000-0000000000dd', '66500000-0000-4000-8000-000000000d11', 'coaching', 'none')$$,
  '23514',
  'new row for relation "assistant_usage" violates check constraint "assistant_usage_route_check"',
  'a route outside the three is refused'
);
select throws_ok(
  $$select pg_temp.add_usage('66500000-0000-4000-8000-0000000000dd', '66500000-0000-4000-8000-000000000d11', 'describe_or_ask', 'sse')$$,
  '23514',
  'new row for relation "assistant_usage" violates check constraint "assistant_usage_transport_check"',
  'a transport outside mcp_http and none is refused'
);
select throws_ok(
  $$select pg_temp.add_usage('66500000-0000-4000-8000-0000000000dd', null)$$,
  '23502',
  'null value in column "turn_id" of relation "assistant_usage" violates not-null constraint',
  'a usage row with no turn is refused'
);
select throws_ok(
  $$select pg_temp.add_usage('66500000-0000-4000-8000-0000000000dd', '66500000-0000-4000-8000-000000000d11', input_count => -1)$$,
  '23514',
  'new row for relation "assistant_usage" violates check constraint "assistant_usage_input_tokens_check"',
  'a negative input token count is refused'
);
select throws_ok(
  $$select pg_temp.add_usage('66500000-0000-4000-8000-0000000000dd', '66500000-0000-4000-8000-000000000d11', output_count => -1)$$,
  '23514',
  'new row for relation "assistant_usage" violates check constraint "assistant_usage_output_tokens_check"',
  'a negative output token count is refused'
);
select throws_ok(
  $$select pg_temp.add_usage('66500000-0000-4000-8000-0000000000dd', '66500000-0000-4000-8000-000000000d11', cache_read_count => -1)$$,
  '23514',
  'new row for relation "assistant_usage" violates check constraint "assistant_usage_cache_read_input_tokens_check"',
  'a negative cache read token count is refused'
);
select throws_ok(
  $$select pg_temp.add_usage('66500000-0000-4000-8000-0000000000dd', '66500000-0000-4000-8000-000000000d11', cache_creation_count => -1)$$,
  '23514',
  'new row for relation "assistant_usage" violates check constraint "assistant_usage_cache_creation_input_tokens_check"',
  'a negative cache creation token count is refused'
);
select throws_ok(
  $$select pg_temp.add_usage('66500000-0000-4000-8000-0000000000dd', '66500000-0000-4000-8000-000000000d11', cost => -1)$$,
  '23514',
  'new row for relation "assistant_usage" violates check constraint "assistant_usage_cost_usd_micros_check"',
  'a negative cost is refused'
);
select throws_ok(
  $$select pg_temp.add_usage('66500000-0000-4000-8000-0000000000dd', '66500000-0000-4000-8000-000000000d11', latency => -1)$$,
  '23514',
  'new row for relation "assistant_usage" violates check constraint "assistant_usage_latency_ms_check"',
  'a negative latency is refused'
);

-- Fixtures for the row level security cases. User A has a conversation with two turns, three actions and
-- five usage rows. User B has one of each. The usage rows are spread over two UTC days for the view, and
-- one of them is written with an offset so that its local day and its UTC day differ.
select lives_ok(
  $$select pg_temp.add_conversation('66500000-0000-4000-8000-0000000000aa', '66500000-0000-4000-8000-000000000a01'),
    pg_temp.add_conversation('66500000-0000-4000-8000-0000000000bb', '66500000-0000-4000-8000-000000000b01')$$,
  'a conversation each is accepted for users A and B'
);
select lives_ok(
  $$select pg_temp.add_turn('66500000-0000-4000-8000-0000000000aa', '66500000-0000-4000-8000-000000000a01', '66500000-0000-4000-8000-000000000a11'),
    pg_temp.add_turn('66500000-0000-4000-8000-0000000000aa', '66500000-0000-4000-8000-000000000a01', '66500000-0000-4000-8000-000000000a12'),
    pg_temp.add_turn('66500000-0000-4000-8000-0000000000bb', '66500000-0000-4000-8000-000000000b01', '66500000-0000-4000-8000-000000000b11')$$,
  'two turns for user A and one for user B are accepted'
);
select lives_ok(
  $$select pg_temp.add_action('66500000-0000-4000-8000-0000000000aa', '66500000-0000-4000-8000-000000000a01', '66500000-0000-4000-8000-000000000a11', 1,
      'log_entry', 'food_log_entries', '66500000-0000-4000-8000-000000000e11'),
    pg_temp.add_action('66500000-0000-4000-8000-0000000000aa', '66500000-0000-4000-8000-000000000a01', '66500000-0000-4000-8000-000000000a11', 2,
      'copy_day', 'food_log_entries', null, array['66500000-0000-4000-8000-000000000e12', '66500000-0000-4000-8000-000000000e13']::uuid[], '2026-10-20'),
    pg_temp.add_action('66500000-0000-4000-8000-0000000000aa', '66500000-0000-4000-8000-000000000a01', '66500000-0000-4000-8000-000000000a12', 1,
      'set_day_complete', 'day_logs', null, null, '2026-10-20'),
    pg_temp.add_action('66500000-0000-4000-8000-0000000000bb', '66500000-0000-4000-8000-000000000b01', '66500000-0000-4000-8000-000000000b11', 1,
      'log_entry', 'food_log_entries', '66500000-0000-4000-8000-000000000e21')$$,
  'three actions for user A and one for user B are accepted'
);
select lives_ok(
  $$select pg_temp.add_usage('66500000-0000-4000-8000-0000000000aa', '66500000-0000-4000-8000-000000000a11', 'describe_or_ask', null, '2026-10-20 08:00:00+00', 10, 20, 30, 40, 500),
    pg_temp.add_usage('66500000-0000-4000-8000-0000000000aa', '66500000-0000-4000-8000-000000000a11', 'describe_or_ask', null, '2026-10-20 08:00:05+00', 1, 2, 3, 4, 50),
    pg_temp.add_usage('66500000-0000-4000-8000-0000000000aa', '66500000-0000-4000-8000-000000000a11', 'compact', null, '2026-10-20 23:59:59+00', 100, 200, 300, 400, 1000),
    pg_temp.add_usage('66500000-0000-4000-8000-0000000000aa', '66500000-0000-4000-8000-000000000a12', 'recipe_parse', null, '2026-10-21 00:00:00+00', 5, 6, 7, 8, 25),
    pg_temp.add_usage('66500000-0000-4000-8000-0000000000aa', '66500000-0000-4000-8000-000000000a12', 'describe_or_ask', null, '2026-10-21 00:30:00+01', 1, 1, 1, 1, 1),
    pg_temp.add_usage('66500000-0000-4000-8000-0000000000bb', '66500000-0000-4000-8000-000000000b11', 'describe_or_ask', null, '2026-10-20 09:00:00+00', 9, 9, 9, 9, 7777)$$,
  'five usage rows for user A and one for user B are accepted'
);

-- User A reads their own rows and no other person's, and cannot write.
set local role authenticated;
set local request.jwt.claims = '{"sub":"66500000-0000-4000-8000-0000000000aa","role":"authenticated"}';

select is(
  (select count(*)::int from public.assistant_actions where user_id = '66500000-0000-4000-8000-0000000000aa'),
  3,
  'user A selects their three actions'
);
select is(
  (select count(*)::int from public.assistant_actions
    where user_id in ('66500000-0000-4000-8000-0000000000aa', '66500000-0000-4000-8000-0000000000bb', '66500000-0000-4000-8000-0000000000cc', '66500000-0000-4000-8000-0000000000dd')),
  3,
  'user A sees no action of users B, C or D in a filter that names them all'
);
select is(
  (select count(*)::int from public.assistant_usage where user_id = '66500000-0000-4000-8000-0000000000aa'),
  5,
  'user A selects their five usage rows'
);
select is(
  (select count(*)::int from public.assistant_usage
    where user_id in ('66500000-0000-4000-8000-0000000000aa', '66500000-0000-4000-8000-0000000000bb', '66500000-0000-4000-8000-0000000000cc', '66500000-0000-4000-8000-0000000000dd')),
  5,
  'user A sees no usage row of users B, C or D in a filter that names them all'
);
select throws_ok(
  $$insert into public.assistant_actions (user_id, turn_seq, tool, target_table)
    values ('66500000-0000-4000-8000-0000000000aa', 1, 'log_entry', 'food_log_entries')$$,
  '42501',
  'permission denied for table assistant_actions',
  'user A cannot insert an action'
);
select throws_ok(
  $$update public.assistant_actions set undone_at = now() where user_id = '66500000-0000-4000-8000-0000000000aa'$$,
  '42501',
  'permission denied for table assistant_actions',
  'user A cannot update their own action'
);
select throws_ok(
  $$delete from public.assistant_actions where user_id = '66500000-0000-4000-8000-0000000000aa'$$,
  '42501',
  'permission denied for table assistant_actions',
  'user A cannot delete their own action'
);
select throws_ok(
  $$insert into public.assistant_usage (user_id, turn_id, route, model, input_tokens, output_tokens, cache_read_input_tokens, cache_creation_input_tokens, cost_usd_micros, latency_ms, transport)
    values ('66500000-0000-4000-8000-0000000000aa', gen_random_uuid(), 'describe_or_ask', 'test-model', 0, 0, 0, 0, 0, 0, 'mcp_http')$$,
  '42501',
  'permission denied for table assistant_usage',
  'user A cannot insert a usage row'
);
select throws_ok(
  $$update public.assistant_usage set cost_usd_micros = 0 where user_id = '66500000-0000-4000-8000-0000000000aa'$$,
  '42501',
  'permission denied for table assistant_usage',
  'user A cannot lower the cost of their own usage rows'
);
select throws_ok(
  $$delete from public.assistant_usage where user_id = '66500000-0000-4000-8000-0000000000aa'$$,
  '42501',
  'permission denied for table assistant_usage',
  'user A cannot delete their own usage rows'
);
select throws_ok(
  $$select public.assistant_spend_this_month()$$,
  '42501',
  'permission denied for function assistant_spend_this_month',
  'user A cannot execute assistant_spend_this_month'
);

-- The view, read by user A. The session time zone is far from UTC, to show that the day is the UTC day.
-- Day 20 holds three rows of the first turn, the compaction row, and a row of the second turn written as
-- 00:30 at +01:00, which is 23:30 UTC on the 20th. Its distinct describe_or_ask turns are the two turns.
-- Day 21 holds only the recipe parse row, so it has no turn.
set local time zone 'Pacific/Auckland';

select is(
  (select count(*)::int from public.assistant_usage_daily where user_id = '66500000-0000-4000-8000-0000000000aa'),
  2,
  'user A reads one view row for each of their two UTC days'
);
select results_eq(
  $$select usage_date, turns, input_tokens, output_tokens, cache_read_input_tokens, cache_creation_input_tokens, cost_usd_micros
    from public.assistant_usage_daily
    where user_id = '66500000-0000-4000-8000-0000000000aa'
    order by usage_date$$,
  $$values
    ('2026-10-20'::date, 2::bigint, 112::bigint, 223::bigint, 334::bigint, 445::bigint, 1551::bigint),
    ('2026-10-21'::date, 0::bigint, 5::bigint, 6::bigint, 7::bigint, 8::bigint, 25::bigint)$$,
  'the view sums user A''s rows for each UTC day, and counts only describe_or_ask turns'
);
select is(
  (select count(*)::int from public.assistant_usage_daily
    where user_id in ('66500000-0000-4000-8000-0000000000bb', '66500000-0000-4000-8000-0000000000dd')),
  0,
  'user A reads no view row of users B or D'
);
select is(
  (select sum(cost_usd_micros)::bigint from public.assistant_usage_daily
    where user_id in ('66500000-0000-4000-8000-0000000000aa', '66500000-0000-4000-8000-0000000000bb', '66500000-0000-4000-8000-0000000000dd')),
  1576::bigint,
  'the cost user A reads through the view leaves out the cost of user B'
);
select throws_ok(
  $$insert into public.assistant_usage_daily (user_id) values ('66500000-0000-4000-8000-0000000000aa')$$,
  '55000',
  'cannot insert into view "assistant_usage_daily"',
  'user A cannot insert into the view, which is not updatable'
);

reset time zone;

-- User B reads their own rows, and nothing of user A's.
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"66500000-0000-4000-8000-0000000000bb","role":"authenticated"}';

select is(
  (select count(*)::int from public.assistant_actions where user_id = '66500000-0000-4000-8000-0000000000bb'),
  1,
  'user B selects their own action'
);
select is(
  (select count(*)::int from public.assistant_actions where user_id = '66500000-0000-4000-8000-0000000000aa'),
  0,
  'user B selecting user A''s actions gets no row'
);
select is(
  (select count(*)::int from public.assistant_usage where user_id = '66500000-0000-4000-8000-0000000000bb'),
  1,
  'user B selects their own usage row'
);
select is(
  (select count(*)::int from public.assistant_usage where user_id = '66500000-0000-4000-8000-0000000000aa'),
  0,
  'user B selecting user A''s usage rows gets no row'
);
select is(
  (select count(*)::int from public.assistant_usage_daily where user_id = '66500000-0000-4000-8000-0000000000bb'),
  1,
  'user B reads their own view row'
);
select is(
  (select count(*)::int from public.assistant_usage_daily where user_id = '66500000-0000-4000-8000-0000000000aa'),
  0,
  'user B reading the view gets none of user A''s rows'
);
select is(
  (select cost_usd_micros from public.assistant_usage_daily where user_id = '66500000-0000-4000-8000-0000000000bb'),
  7777::bigint,
  'user B''s view row sums only user B''s cost'
);

-- Anon reads nothing and writes nothing.
reset role;
set local role anon;

select throws_ok(
  $$select count(*) from public.assistant_actions$$,
  '42501',
  'permission denied for table assistant_actions',
  'anon cannot select from assistant_actions'
);
select throws_ok(
  $$select count(*) from public.assistant_usage$$,
  '42501',
  'permission denied for table assistant_usage',
  'anon cannot select from assistant_usage'
);
select throws_ok(
  $$select count(*) from public.assistant_usage_daily$$,
  '42501',
  'permission denied for view assistant_usage_daily',
  'anon cannot select from assistant_usage_daily'
);
select throws_ok(
  $$select public.assistant_spend_this_month()$$,
  '42501',
  'permission denied for function assistant_spend_this_month',
  'anon cannot execute assistant_spend_this_month'
);

reset role;

-- The month's spend. The baseline is read just before this case's own rows go in, so rows that the shared
-- database already holds do not matter. The session time zone is set 13 hours ahead of UTC, so a function
-- that cut the month in the session's zone would count the row an hour before the UTC month began. The rows
-- are, for user D: the first instant of the month (counts, 100), now (counts, 250), an hour before the month
-- (does not count) and a month before (does not count), and for user B: now (counts, 5, to show the sum
-- runs over every user).
set local time zone 'Pacific/Auckland';

select set_config('key665.spend_baseline', public.assistant_spend_this_month()::text, true);

select lives_ok(
  $$select pg_temp.add_usage('66500000-0000-4000-8000-0000000000dd', '66500000-0000-4000-8000-000000000d11', usage_time => pg_temp.utc_month_start(), cost => 100),
    pg_temp.add_usage('66500000-0000-4000-8000-0000000000dd', '66500000-0000-4000-8000-000000000d11', usage_time => now(), cost => 250),
    pg_temp.add_usage('66500000-0000-4000-8000-0000000000dd', '66500000-0000-4000-8000-000000000d11', usage_time => pg_temp.utc_month_start() - interval '1 hour', cost => 1000000),
    pg_temp.add_usage('66500000-0000-4000-8000-0000000000dd', '66500000-0000-4000-8000-000000000d11', usage_time => pg_temp.utc_month_start() - interval '1 month', cost => 2000000),
    pg_temp.add_usage('66500000-0000-4000-8000-0000000000bb', '66500000-0000-4000-8000-000000000b11', usage_time => now(), cost => 5)$$,
  'five usage rows are accepted for the month''s spend'
);

-- The service role writes the actions, and only inserts usage.
set local role service_role;

select is(
  public.assistant_spend_this_month() - current_setting('key665.spend_baseline')::bigint,
  355::bigint,
  'assistant_spend_this_month() adds the three rows of this UTC month and leaves out the rows before it'
);
select lives_ok(
  $$select pg_temp.add_action('66500000-0000-4000-8000-0000000000dd', '66500000-0000-4000-8000-000000000d01', '66500000-0000-4000-8000-000000000d13', 1)$$,
  'the service role inserts an action that reserves a slot'
);
select lives_ok(
  $$update public.assistant_actions
    set target_id = '66500000-0000-4000-8000-000000000e31', target_updated_at = now()
    where turn_id = '66500000-0000-4000-8000-000000000d13' and turn_seq = 1$$,
  'the service role fills in the target when the write lands'
);
select is(
  (select target_id from public.assistant_actions where turn_id = '66500000-0000-4000-8000-000000000d13' and turn_seq = 1),
  '66500000-0000-4000-8000-000000000e31'::uuid,
  'the service role reads the target back'
);
select lives_ok(
  $$delete from public.assistant_actions where turn_id = '66500000-0000-4000-8000-000000000d13' and turn_seq = 1$$,
  'the service role deletes an action, as it releases a slot when a write fails'
);
select is(
  (select count(*)::int from public.assistant_actions where turn_id = '66500000-0000-4000-8000-000000000d13'),
  0,
  'the released slot is gone'
);
select lives_ok(
  $$select pg_temp.add_usage('66500000-0000-4000-8000-0000000000dd', '66500000-0000-4000-8000-000000000d13')$$,
  'the service role inserts a usage row'
);
select throws_ok(
  $$select count(*) from public.assistant_usage$$,
  '42501',
  'permission denied for table assistant_usage',
  'the service role cannot select from assistant_usage'
);
select throws_ok(
  $$update public.assistant_usage set cost_usd_micros = 0 where user_id = '66500000-0000-4000-8000-0000000000dd'$$,
  '42501',
  'permission denied for table assistant_usage',
  'the service role cannot update a usage row'
);
select throws_ok(
  $$delete from public.assistant_usage where user_id = '66500000-0000-4000-8000-0000000000dd'$$,
  '42501',
  'permission denied for table assistant_usage',
  'the service role cannot delete a usage row'
);
select throws_ok(
  $$select count(*) from public.assistant_usage_daily$$,
  '42501',
  'permission denied for view assistant_usage_daily',
  'the service role cannot select from assistant_usage_daily'
);

reset role;
reset time zone;

-- Deleting a conversation. User A deletes their own conversation, which takes its turns with it. Their
-- three actions stay with the conversation and the turn set null, and two of them now share the slot
-- number 1 with no turn. The usage rows stay and the view reads the same.
set local role authenticated;
set local request.jwt.claims = '{"sub":"66500000-0000-4000-8000-0000000000aa","role":"authenticated"}';

select is(
  pg_temp.affected_rows($$delete from public.assistant_conversations where id = '66500000-0000-4000-8000-000000000a01'$$),
  1::bigint,
  'user A deletes their own conversation'
);
select is(
  (select count(*)::int from public.assistant_turns where conversation_id = '66500000-0000-4000-8000-000000000a01'),
  0,
  'the turns of the deleted conversation are gone'
);
select is(
  (select count(*)::int from public.assistant_actions where user_id = '66500000-0000-4000-8000-0000000000aa'),
  3,
  'user A keeps all three actions after deleting the conversation'
);
select is(
  (select count(*)::int from public.assistant_actions
    where user_id = '66500000-0000-4000-8000-0000000000aa' and conversation_id is null),
  3,
  'the conversation_id of every action of user A is null'
);
select is(
  (select count(*)::int from public.assistant_actions
    where user_id = '66500000-0000-4000-8000-0000000000aa' and turn_id is null and turn_seq = 1),
  2,
  'the turn_id of every action of user A is null, and two of them now share slot 1'
);
select is(
  (select count(*)::int from public.assistant_actions
    where user_id = '66500000-0000-4000-8000-0000000000aa' and target_ids is not null and target_local_date is not null),
  1,
  'what an action named is kept after the conversation goes'
);
select is(
  (select count(*)::int from public.assistant_usage where user_id = '66500000-0000-4000-8000-0000000000aa'),
  5,
  'user A keeps all five usage rows after deleting the conversation'
);
select is(
  (select sum(cost_usd_micros)::bigint from public.assistant_usage_daily where user_id = '66500000-0000-4000-8000-0000000000aa'),
  1576::bigint,
  'the cost in the view is the same after the conversation is deleted'
);

reset role;

-- The cascade from the auth user. User C has a conversation, a turn, two actions and two usage rows.
-- Deleting the auth user removes them, and the rows of the other users stay.
select lives_ok(
  $$select pg_temp.add_conversation('66500000-0000-4000-8000-0000000000cc', '66500000-0000-4000-8000-000000000c01')$$,
  'a conversation is accepted for the account deletion case'
);
select lives_ok(
  $$select pg_temp.add_turn('66500000-0000-4000-8000-0000000000cc', '66500000-0000-4000-8000-000000000c01', '66500000-0000-4000-8000-000000000c11')$$,
  'a turn is accepted for the account deletion case'
);
select lives_ok(
  $$select pg_temp.add_action('66500000-0000-4000-8000-0000000000cc', '66500000-0000-4000-8000-000000000c01', '66500000-0000-4000-8000-000000000c11', 1),
    pg_temp.add_action('66500000-0000-4000-8000-0000000000cc', '66500000-0000-4000-8000-000000000c01', '66500000-0000-4000-8000-000000000c11', 2)$$,
  'two actions are accepted for the account deletion case'
);
select lives_ok(
  $$select pg_temp.add_usage('66500000-0000-4000-8000-0000000000cc', '66500000-0000-4000-8000-000000000c11'),
    pg_temp.add_usage('66500000-0000-4000-8000-0000000000cc', '66500000-0000-4000-8000-000000000c11', 'compact')$$,
  'two usage rows are accepted for the account deletion case'
);
select lives_ok(
  $$delete from auth.users where id = '66500000-0000-4000-8000-0000000000cc'$$,
  'deleting an auth user with actions and usage succeeds'
);
select is(
  (select count(*)::int from public.assistant_actions where user_id = '66500000-0000-4000-8000-0000000000cc'),
  0,
  'the actions of the deleted user are gone'
);
select is(
  (select count(*)::int from public.assistant_usage where user_id = '66500000-0000-4000-8000-0000000000cc'),
  0,
  'the usage rows of the deleted user are gone'
);
select is(
  (select count(*)::int from public.assistant_actions where user_id = '66500000-0000-4000-8000-0000000000bb'),
  1,
  'the action of another user is untouched by the deletion'
);
select is(
  (select count(*)::int from public.assistant_usage where user_id in ('66500000-0000-4000-8000-0000000000aa', '66500000-0000-4000-8000-0000000000bb')),
  7,
  'the usage rows of other users are untouched by the deletion'
);

select * from finish();

rollback;
