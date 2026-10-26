-- Asserts public.assistant_conversations, public.assistant_turns and public.assistant_messages
-- (ADR 0003, Amendment 14, and ADR 0006): the columns, the checks, the keys, the indexes, the
-- privileges, the owner-only policies, the cascade from a conversation and the cascade from the auth
-- user.
--
-- `supabase test db` runs this file as postgres inside a transaction that is rolled back, so nothing
-- created here persists. Every fixture id starts with 66400000 and every email with key664-. Each
-- actor is entered with `set local role` plus the JWT claims that `auth.uid()` reads, and left with
-- `reset role`.
--
-- A conversation is health data in real use. The fixtures are made up: the text of every message and
-- of every note is the word test, and no assertion name quotes a value except where the value is the
-- case under test (a status, a role, a seq). Every row is found by its id or its owner, never by a
-- whole-table count.
--
-- Fixture users: a and b (row level security and the client refusals), c (the cascade from the auth
-- user), d (the checks and the service role).

begin;

select plan(157);

insert into auth.users (instance_id, id, aud, role, email) values
  ('00000000-0000-0000-0000-000000000000', '66400000-0000-4000-8000-0000000000aa', 'authenticated', 'authenticated', 'key664-conversations-a@keylow.test'),
  ('00000000-0000-0000-0000-000000000000', '66400000-0000-4000-8000-0000000000bb', 'authenticated', 'authenticated', 'key664-conversations-b@keylow.test'),
  ('00000000-0000-0000-0000-000000000000', '66400000-0000-4000-8000-0000000000cc', 'authenticated', 'authenticated', 'key664-conversations-c@keylow.test'),
  ('00000000-0000-0000-0000-000000000000', '66400000-0000-4000-8000-0000000000dd', 'authenticated', 'authenticated', 'key664-conversations-d@keylow.test');

-- One conversation with an id the case chooses. It runs as whoever calls it, postgres in the cases
-- below, so it is the table's constraints that decide and not its grants. A note is passed as the two
-- compaction columns together, or not at all.
create function pg_temp.add_conversation(
  owner uuid,
  conversation uuid,
  note text default null,
  through_turn uuid default null
)
returns void
language sql
as $$
  insert into public.assistant_conversations (id, user_id, compaction_summary, compacted_through_turn_id)
  values (conversation, owner, note, through_turn)
$$;

-- One turn with an id the case chooses. The id of the user's message is made up, because it names a
-- row of assistant_messages with no foreign key.
create function pg_temp.add_turn(
  owner uuid,
  conversation uuid,
  turn uuid,
  turn_status text default 'open'
)
returns void
language sql
as $$
  insert into public.assistant_turns (id, conversation_id, user_id, user_message_id, status)
  values (turn, conversation, owner, gen_random_uuid(), turn_status)
$$;

-- One message with an id the case chooses.
create function pg_temp.add_message(
  owner uuid,
  conversation uuid,
  turn uuid,
  message uuid,
  message_seq integer,
  message_role text default 'user'
)
returns void
language sql
as $$
  insert into public.assistant_messages (id, conversation_id, turn_id, user_id, role, content, seq)
  values (message, conversation, turn, owner, message_role, '[{"type": "text", "text": "test"}]', message_seq)
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

-- Shape: assistant_conversations.
select has_table('public', 'assistant_conversations', 'assistant_conversations exists');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.assistant_conversations'::regclass),
  'row level security is enabled on assistant_conversations'
);
select is(
  (select array_agg(
      column_name || ' ' || data_type || case when is_nullable = 'NO' then ' not null' else '' end
        || coalesce(' default ' || column_default, '')
      order by ordinal_position
    )
    from information_schema.columns where table_schema = 'public' and table_name = 'assistant_conversations'),
  array[
    'id uuid not null default gen_random_uuid()',
    'user_id uuid not null',
    'title text',
    'compaction_summary text',
    'compacted_through_turn_id uuid',
    'created_at timestamp with time zone not null default now()',
    'updated_at timestamp with time zone not null default now()'
  ],
  'assistant_conversations has the amendment''s columns, types, nullability and defaults'
);
select col_is_pk('public', 'assistant_conversations', 'id', 'the primary key is id');
select fk_ok('public', 'assistant_conversations', 'user_id', 'auth', 'users', 'id', 'user_id references auth.users');
select is(
  (select confdeltype::text from pg_constraint where conrelid = 'public.assistant_conversations'::regclass and conname = 'assistant_conversations_user_id_fkey'),
  'c',
  'the user_id foreign key cascades on delete'
);
select is(
  (select count(*)::int from pg_constraint where conrelid = 'public.assistant_conversations'::regclass and contype = 'f'),
  1,
  'compacted_through_turn_id has no foreign key, so the only foreign key is user_id'
);
select is(
  (select count(*)::int from pg_trigger where tgrelid = 'public.assistant_conversations'::regclass and not tgisinternal),
  0,
  'assistant_conversations has no trigger, so the writer sets updated_at'
);

-- Shape: assistant_turns.
select has_table('public', 'assistant_turns', 'assistant_turns exists');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.assistant_turns'::regclass),
  'row level security is enabled on assistant_turns'
);
select is(
  (select array_agg(
      column_name || ' ' || data_type || case when is_nullable = 'NO' then ' not null' else '' end
        || coalesce(' default ' || column_default, '')
      order by ordinal_position
    )
    from information_schema.columns where table_schema = 'public' and table_name = 'assistant_turns'),
  array[
    'id uuid not null default gen_random_uuid()',
    'conversation_id uuid not null',
    'user_id uuid not null',
    'user_message_id uuid not null',
    'status text not null default ''open''::text',
    'pending_confirmation jsonb',
    'created_at timestamp with time zone not null default now()',
    'finished_at timestamp with time zone'
  ],
  'assistant_turns has the amendment''s columns, types, nullability and defaults'
);
select col_is_pk('public', 'assistant_turns', 'id', 'the primary key is id');
select fk_ok(
  'public', 'assistant_turns', 'conversation_id', 'public', 'assistant_conversations', 'id',
  'conversation_id references assistant_conversations'
);
select is(
  (select confdeltype::text from pg_constraint where conrelid = 'public.assistant_turns'::regclass and conname = 'assistant_turns_conversation_id_fkey'),
  'c',
  'the conversation_id foreign key cascades on delete'
);
select fk_ok('public', 'assistant_turns', 'user_id', 'auth', 'users', 'id', 'user_id references auth.users');
select is(
  (select confdeltype::text from pg_constraint where conrelid = 'public.assistant_turns'::regclass and conname = 'assistant_turns_user_id_fkey'),
  'c',
  'the user_id foreign key cascades on delete'
);
select is(
  (select count(*)::int from pg_constraint where conrelid = 'public.assistant_turns'::regclass and contype = 'f'),
  2,
  'user_message_id has no foreign key, so the only foreign keys are conversation_id and user_id'
);
select is(
  (select count(*)::int from pg_trigger where tgrelid = 'public.assistant_turns'::regclass and not tgisinternal),
  0,
  'assistant_turns has no trigger'
);

-- Shape: assistant_messages.
select has_table('public', 'assistant_messages', 'assistant_messages exists');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.assistant_messages'::regclass),
  'row level security is enabled on assistant_messages'
);
select is(
  (select array_agg(
      column_name || ' ' || data_type || case when is_nullable = 'NO' then ' not null' else '' end
        || coalesce(' default ' || column_default, '')
      order by ordinal_position
    )
    from information_schema.columns where table_schema = 'public' and table_name = 'assistant_messages'),
  array[
    'id uuid not null default gen_random_uuid()',
    'conversation_id uuid not null',
    'turn_id uuid not null',
    'user_id uuid not null',
    'role text not null',
    'content jsonb not null',
    'seq integer not null',
    'created_at timestamp with time zone not null default now()'
  ],
  'assistant_messages has the amendment''s columns, types, nullability and defaults'
);
select col_is_pk('public', 'assistant_messages', 'id', 'the primary key is id');
select fk_ok(
  'public', 'assistant_messages', 'conversation_id', 'public', 'assistant_conversations', 'id',
  'conversation_id references assistant_conversations'
);
select is(
  (select confdeltype::text from pg_constraint where conrelid = 'public.assistant_messages'::regclass and conname = 'assistant_messages_conversation_id_fkey'),
  'c',
  'the conversation_id foreign key cascades on delete'
);
select fk_ok('public', 'assistant_messages', 'turn_id', 'public', 'assistant_turns', 'id', 'turn_id references assistant_turns');
select is(
  (select confdeltype::text from pg_constraint where conrelid = 'public.assistant_messages'::regclass and conname = 'assistant_messages_turn_id_fkey'),
  'c',
  'the turn_id foreign key cascades on delete'
);
select fk_ok('public', 'assistant_messages', 'user_id', 'auth', 'users', 'id', 'user_id references auth.users');
select is(
  (select confdeltype::text from pg_constraint where conrelid = 'public.assistant_messages'::regclass and conname = 'assistant_messages_user_id_fkey'),
  'c',
  'the user_id foreign key cascades on delete'
);
select is(
  (select count(*)::int from pg_trigger where tgrelid = 'public.assistant_messages'::regclass and not tgisinternal),
  0,
  'assistant_messages has no trigger'
);

-- Indexes. Each table has its primary key, the indexes the amendment names and no other.
select is(
  (select array_agg(indexname::text order by indexname) from pg_indexes where schemaname = 'public' and tablename = 'assistant_conversations'),
  array['assistant_conversations_pkey', 'assistant_conversations_user_id_updated_at_idx'],
  'assistant_conversations has the primary key and the user_id and updated_at index and no other index'
);
select is(
  (select indexdef from pg_indexes where schemaname = 'public' and indexname = 'assistant_conversations_user_id_updated_at_idx'),
  'CREATE INDEX assistant_conversations_user_id_updated_at_idx ON public.assistant_conversations USING btree (user_id, updated_at DESC)',
  'the conversations index is on user_id and updated_at descending, so it finds the newest and serves the cascade from auth.users'
);
select is(
  (select array_agg(indexname::text order by indexname) from pg_indexes where schemaname = 'public' and tablename = 'assistant_turns'),
  array['assistant_turns_conversation_id_created_at_idx', 'assistant_turns_pkey', 'assistant_turns_user_id_idx'],
  'assistant_turns has the primary key, the conversation_id and created_at index and the user_id index and no other index'
);
select is(
  (select indexdef from pg_indexes where schemaname = 'public' and indexname = 'assistant_turns_conversation_id_created_at_idx'),
  'CREATE INDEX assistant_turns_conversation_id_created_at_idx ON public.assistant_turns USING btree (conversation_id, created_at)',
  'the turns index is on conversation_id and created_at'
);
select is(
  (select indexdef from pg_indexes where schemaname = 'public' and indexname = 'assistant_turns_user_id_idx'),
  'CREATE INDEX assistant_turns_user_id_idx ON public.assistant_turns USING btree (user_id)',
  'the turns user_id index is on user_id, for the cascade from auth.users'
);
select is(
  (select array_agg(indexname::text order by indexname) from pg_indexes where schemaname = 'public' and tablename = 'assistant_messages'),
  array[
    'assistant_messages_conversation_id_seq_key', 'assistant_messages_pkey', 'assistant_messages_turn_id_idx',
    'assistant_messages_user_id_idx'
  ],
  'assistant_messages has the primary key, the unique conversation_id and seq key, the turn_id index and the user_id index and no other index'
);
select is(
  (select indexdef from pg_indexes where schemaname = 'public' and indexname = 'assistant_messages_conversation_id_seq_key'),
  'CREATE UNIQUE INDEX assistant_messages_conversation_id_seq_key ON public.assistant_messages USING btree (conversation_id, seq)',
  'the unique key is on conversation_id and seq, which is the ordering index and replaces one on created_at'
);
select is(
  (select indexdef from pg_indexes where schemaname = 'public' and indexname = 'assistant_messages_turn_id_idx'),
  'CREATE INDEX assistant_messages_turn_id_idx ON public.assistant_messages USING btree (turn_id)',
  'the messages turn_id index is on turn_id, for the cascade from a turn'
);
select is(
  (select indexdef from pg_indexes where schemaname = 'public' and indexname = 'assistant_messages_user_id_idx'),
  'CREATE INDEX assistant_messages_user_id_idx ON public.assistant_messages USING btree (user_id)',
  'the messages user_id index is on user_id, for the cascade from auth.users'
);

-- Policies, read from the catalog. Every table has a select policy for the owner, and conversations
-- also have a delete policy. Turns and messages have no delete policy, because they go by the cascade.
select policies_are(
  'public',
  'assistant_conversations',
  array['assistant_conversations_select_own', 'assistant_conversations_delete_own'],
  'assistant_conversations has exactly a select policy and a delete policy'
);
select policy_cmd_is('public', 'assistant_conversations', 'assistant_conversations_select_own', 'select', 'assistant_conversations_select_own is for select');
select policy_cmd_is('public', 'assistant_conversations', 'assistant_conversations_delete_own', 'delete', 'assistant_conversations_delete_own is for delete');
select policy_roles_are(
  'public', 'assistant_conversations', 'assistant_conversations_select_own', array['authenticated'],
  'assistant_conversations_select_own is for authenticated only'
);
select policy_roles_are(
  'public', 'assistant_conversations', 'assistant_conversations_delete_own', array['authenticated'],
  'assistant_conversations_delete_own is for authenticated only'
);
select policies_are('public', 'assistant_turns', array['assistant_turns_select_own'], 'assistant_turns has exactly one policy');
select policy_cmd_is('public', 'assistant_turns', 'assistant_turns_select_own', 'select', 'assistant_turns_select_own is for select');
select policy_roles_are('public', 'assistant_turns', 'assistant_turns_select_own', array['authenticated'], 'assistant_turns_select_own is for authenticated only');
select policies_are('public', 'assistant_messages', array['assistant_messages_select_own'], 'assistant_messages has exactly one policy');
select policy_cmd_is('public', 'assistant_messages', 'assistant_messages_select_own', 'select', 'assistant_messages_select_own is for select');
select policy_roles_are('public', 'assistant_messages', 'assistant_messages_select_own', array['authenticated'], 'assistant_messages_select_own is for authenticated only');

-- Each policy reads the caller as `(select auth.uid())`, which Postgres evaluates once per statement and
-- renders with the subselect. A bare `auth.uid()` would be evaluated once per row and shows no subselect.
select ok(
  (select qual from pg_policies where schemaname = 'public' and tablename = 'assistant_conversations' and policyname = 'assistant_conversations_select_own')
    like '%user_id = ( SELECT auth.uid()%',
  'assistant_conversations_select_own tests user_id against (select auth.uid())'
);
select ok(
  (select qual from pg_policies where schemaname = 'public' and tablename = 'assistant_conversations' and policyname = 'assistant_conversations_delete_own')
    like '%user_id = ( SELECT auth.uid()%',
  'assistant_conversations_delete_own tests user_id against (select auth.uid())'
);
select ok(
  (select qual from pg_policies where schemaname = 'public' and tablename = 'assistant_turns' and policyname = 'assistant_turns_select_own')
    like '%user_id = ( SELECT auth.uid()%',
  'assistant_turns_select_own tests user_id against (select auth.uid())'
);
select ok(
  (select qual from pg_policies where schemaname = 'public' and tablename = 'assistant_messages' and policyname = 'assistant_messages_select_own')
    like '%user_id = ( SELECT auth.uid()%',
  'assistant_messages_select_own tests user_id against (select auth.uid())'
);

-- Privileges, read from the catalog.
select is(
  (select array_agg(privilege_type::text order by privilege_type) from information_schema.table_privileges
    where table_schema = 'public' and table_name = 'assistant_conversations' and grantee = 'authenticated'),
  array['DELETE', 'SELECT'],
  'authenticated holds table level select and delete on assistant_conversations and nothing else'
);
select is(
  (select array_agg(privilege_type::text order by privilege_type) from information_schema.table_privileges
    where table_schema = 'public' and table_name = 'assistant_turns' and grantee = 'authenticated'),
  array['SELECT'],
  'authenticated holds table level select on assistant_turns and nothing else'
);
select is(
  (select array_agg(privilege_type::text order by privilege_type) from information_schema.table_privileges
    where table_schema = 'public' and table_name = 'assistant_messages' and grantee = 'authenticated'),
  array['SELECT'],
  'authenticated holds table level select on assistant_messages and nothing else'
);
select is(
  (select array_agg(table_name::text || ' ' || privilege_type::text order by table_name, privilege_type)
    from information_schema.table_privileges
    where table_schema = 'public'
      and table_name in ('assistant_conversations', 'assistant_turns', 'assistant_messages')
      and grantee = 'service_role'),
  array[
    'assistant_conversations INSERT', 'assistant_conversations SELECT', 'assistant_conversations UPDATE',
    'assistant_messages INSERT', 'assistant_messages SELECT', 'assistant_messages UPDATE',
    'assistant_turns INSERT', 'assistant_turns SELECT', 'assistant_turns UPDATE'
  ],
  'service_role holds table level select, insert and update on the three tables and nothing else'
);
select is(
  (select count(*)::int from information_schema.column_privileges
    where table_schema = 'public'
      and table_name in ('assistant_conversations', 'assistant_turns', 'assistant_messages')
      and grantee in ('authenticated', 'service_role')
      and privilege_type not in ('SELECT', 'INSERT', 'UPDATE', 'DELETE')),
  0,
  'no references privilege is held by authenticated or service_role on any column of the three tables'
);
select ok(
  not has_table_privilege('authenticated', 'public.assistant_conversations', 'insert')
    and not has_table_privilege('authenticated', 'public.assistant_conversations', 'update')
    and not has_table_privilege('authenticated', 'public.assistant_conversations', 'truncate')
    and not has_table_privilege('authenticated', 'public.assistant_conversations', 'references')
    and not has_table_privilege('authenticated', 'public.assistant_conversations', 'trigger')
    and not has_any_column_privilege('authenticated', 'public.assistant_conversations', 'insert')
    and not has_any_column_privilege('authenticated', 'public.assistant_conversations', 'update')
    and not has_any_column_privilege('authenticated', 'public.assistant_conversations', 'references'),
  'authenticated has no insert, update or other privilege on assistant_conversations beyond select and delete'
);
select ok(
  not has_table_privilege('authenticated', 'public.assistant_turns', 'insert')
    and not has_table_privilege('authenticated', 'public.assistant_turns', 'update')
    and not has_table_privilege('authenticated', 'public.assistant_turns', 'delete')
    and not has_table_privilege('authenticated', 'public.assistant_turns', 'truncate')
    and not has_table_privilege('authenticated', 'public.assistant_turns', 'references')
    and not has_table_privilege('authenticated', 'public.assistant_turns', 'trigger')
    and not has_any_column_privilege('authenticated', 'public.assistant_turns', 'insert')
    and not has_any_column_privilege('authenticated', 'public.assistant_turns', 'update')
    and not has_any_column_privilege('authenticated', 'public.assistant_turns', 'references'),
  'authenticated has no write privilege of any kind on assistant_turns'
);
select ok(
  not has_table_privilege('authenticated', 'public.assistant_messages', 'insert')
    and not has_table_privilege('authenticated', 'public.assistant_messages', 'update')
    and not has_table_privilege('authenticated', 'public.assistant_messages', 'delete')
    and not has_table_privilege('authenticated', 'public.assistant_messages', 'truncate')
    and not has_table_privilege('authenticated', 'public.assistant_messages', 'references')
    and not has_table_privilege('authenticated', 'public.assistant_messages', 'trigger')
    and not has_any_column_privilege('authenticated', 'public.assistant_messages', 'insert')
    and not has_any_column_privilege('authenticated', 'public.assistant_messages', 'update')
    and not has_any_column_privilege('authenticated', 'public.assistant_messages', 'references'),
  'authenticated has no write privilege of any kind on assistant_messages'
);
select ok(
  not has_table_privilege('service_role', 'public.assistant_conversations', 'delete')
    and not has_table_privilege('service_role', 'public.assistant_conversations', 'truncate')
    and not has_table_privilege('service_role', 'public.assistant_turns', 'delete')
    and not has_table_privilege('service_role', 'public.assistant_turns', 'truncate')
    and not has_table_privilege('service_role', 'public.assistant_messages', 'delete')
    and not has_table_privilege('service_role', 'public.assistant_messages', 'truncate'),
  'service_role cannot delete or truncate on any of the three tables'
);
select ok(
  not has_table_privilege('anon', 'public.assistant_conversations', 'select')
    and not has_table_privilege('anon', 'public.assistant_conversations', 'insert')
    and not has_table_privilege('anon', 'public.assistant_conversations', 'update')
    and not has_table_privilege('anon', 'public.assistant_conversations', 'delete')
    and not has_any_column_privilege('anon', 'public.assistant_conversations', 'select')
    and not has_any_column_privilege('anon', 'public.assistant_conversations', 'insert')
    and not has_any_column_privilege('anon', 'public.assistant_conversations', 'update'),
  'anon has no privilege on assistant_conversations'
);
select ok(
  not has_table_privilege('anon', 'public.assistant_turns', 'select')
    and not has_table_privilege('anon', 'public.assistant_turns', 'insert')
    and not has_table_privilege('anon', 'public.assistant_turns', 'update')
    and not has_table_privilege('anon', 'public.assistant_turns', 'delete')
    and not has_any_column_privilege('anon', 'public.assistant_turns', 'select')
    and not has_any_column_privilege('anon', 'public.assistant_turns', 'insert')
    and not has_any_column_privilege('anon', 'public.assistant_turns', 'update'),
  'anon has no privilege on assistant_turns'
);
select ok(
  not has_table_privilege('anon', 'public.assistant_messages', 'select')
    and not has_table_privilege('anon', 'public.assistant_messages', 'insert')
    and not has_table_privilege('anon', 'public.assistant_messages', 'update')
    and not has_table_privilege('anon', 'public.assistant_messages', 'delete')
    and not has_any_column_privilege('anon', 'public.assistant_messages', 'select')
    and not has_any_column_privilege('anon', 'public.assistant_messages', 'insert')
    and not has_any_column_privilege('anon', 'public.assistant_messages', 'update'),
  'anon has no privilege on assistant_messages'
);

-- Checks and keys, as postgres, on user D. One conversation and one turn carry the cases.
select lives_ok(
  $$select pg_temp.add_conversation('66400000-0000-4000-8000-0000000000dd', '66400000-0000-4000-8000-000000000d01')$$,
  'a conversation with no note is accepted'
);
select lives_ok(
  $$select pg_temp.add_turn('66400000-0000-4000-8000-0000000000dd', '66400000-0000-4000-8000-000000000d01', '66400000-0000-4000-8000-000000000d11')$$,
  'a turn that is open by default is accepted'
);
select is(
  (select status from public.assistant_turns where id = '66400000-0000-4000-8000-000000000d11'),
  'open',
  'a turn is open when no status is given'
);
select lives_ok(
  $$insert into public.assistant_turns (conversation_id, user_id, user_message_id, status)
    select '66400000-0000-4000-8000-000000000d01', '66400000-0000-4000-8000-0000000000dd', gen_random_uuid(), turn_status
    from unnest(array['open', 'complete', 'clarify', 'confirm', 'stopped', 'failed', 'refused']) as turn_status$$,
  'each of the seven statuses is accepted'
);
select throws_ok(
  $$select pg_temp.add_turn('66400000-0000-4000-8000-0000000000dd', '66400000-0000-4000-8000-000000000d01', gen_random_uuid(), 'done')$$,
  '23514',
  'new row for relation "assistant_turns" violates check constraint "assistant_turns_status_check"',
  'the earlier status done is refused'
);
select throws_ok(
  $$select pg_temp.add_turn('66400000-0000-4000-8000-0000000000dd', '66400000-0000-4000-8000-000000000d01', gen_random_uuid(), 'Complete')$$,
  '23514',
  'new row for relation "assistant_turns" violates check constraint "assistant_turns_status_check"',
  'a status in the wrong case is refused'
);
select throws_ok(
  $$select pg_temp.add_turn('66400000-0000-4000-8000-0000000000dd', '66400000-0000-4000-8000-000000000d01', gen_random_uuid(), null)$$,
  '23502',
  'null value in column "status" of relation "assistant_turns" violates not-null constraint',
  'a null status is refused'
);
select throws_ok(
  $$select pg_temp.add_turn('66400000-0000-4000-8000-0000000000dd', '66400000-0000-4000-8000-000000000f01', gen_random_uuid())$$,
  '23503',
  'insert or update on table "assistant_turns" violates foreign key constraint "assistant_turns_conversation_id_fkey"',
  'a turn for a conversation that does not exist is refused'
);

select lives_ok(
  $$select pg_temp.add_message('66400000-0000-4000-8000-0000000000dd', '66400000-0000-4000-8000-000000000d01', '66400000-0000-4000-8000-000000000d11', '66400000-0000-4000-8000-000000000d21', 1, 'user')$$,
  'a user message with seq 1 is accepted'
);
select lives_ok(
  $$select pg_temp.add_message('66400000-0000-4000-8000-0000000000dd', '66400000-0000-4000-8000-000000000d01', '66400000-0000-4000-8000-000000000d11', '66400000-0000-4000-8000-000000000d22', 2, 'assistant')$$,
  'an assistant message with seq 2 is accepted'
);
select throws_ok(
  $$select pg_temp.add_message('66400000-0000-4000-8000-0000000000dd', '66400000-0000-4000-8000-000000000d01', '66400000-0000-4000-8000-000000000d11', gen_random_uuid(), 3, 'system')$$,
  '23514',
  'new row for relation "assistant_messages" violates check constraint "assistant_messages_role_check"',
  'the role system is refused'
);
select throws_ok(
  $$select pg_temp.add_message('66400000-0000-4000-8000-0000000000dd', '66400000-0000-4000-8000-000000000d01', '66400000-0000-4000-8000-000000000d11', gen_random_uuid(), 3, 'tool')$$,
  '23514',
  'new row for relation "assistant_messages" violates check constraint "assistant_messages_role_check"',
  'the role tool is refused'
);
select throws_ok(
  $$select pg_temp.add_message('66400000-0000-4000-8000-0000000000dd', '66400000-0000-4000-8000-000000000d01', '66400000-0000-4000-8000-000000000d11', gen_random_uuid(), null)$$,
  '23502',
  'null value in column "seq" of relation "assistant_messages" violates not-null constraint',
  'a message with no seq is refused'
);
select throws_ok(
  $$select pg_temp.add_message('66400000-0000-4000-8000-0000000000dd', '66400000-0000-4000-8000-000000000d01', '66400000-0000-4000-8000-000000000d11', gen_random_uuid(), 2)$$,
  '23505',
  'duplicate key value violates unique constraint "assistant_messages_conversation_id_seq_key"',
  'a second message with the same seq in the same conversation is refused'
);
select lives_ok(
  $$select pg_temp.add_conversation('66400000-0000-4000-8000-0000000000dd', '66400000-0000-4000-8000-000000000d02')$$,
  'a second conversation is accepted'
);
select lives_ok(
  $$select pg_temp.add_turn('66400000-0000-4000-8000-0000000000dd', '66400000-0000-4000-8000-000000000d02', '66400000-0000-4000-8000-000000000d12')$$,
  'a turn of the second conversation is accepted'
);
select lives_ok(
  $$select pg_temp.add_message('66400000-0000-4000-8000-0000000000dd', '66400000-0000-4000-8000-000000000d02', '66400000-0000-4000-8000-000000000d12', gen_random_uuid(), 2)$$,
  'the same seq in another conversation is accepted'
);
select throws_ok(
  $$select pg_temp.add_message('66400000-0000-4000-8000-0000000000dd', '66400000-0000-4000-8000-000000000d01', '66400000-0000-4000-8000-000000000f11', gen_random_uuid(), 9)$$,
  '23503',
  'insert or update on table "assistant_messages" violates foreign key constraint "assistant_messages_turn_id_fkey"',
  'a message for a turn that does not exist is refused'
);

-- The two compaction columns are null together or set together. The through turn is made up, because the
-- column has no foreign key.
select lives_ok(
  $$select pg_temp.add_conversation('66400000-0000-4000-8000-0000000000dd', '66400000-0000-4000-8000-000000000d03', 'test', '66400000-0000-4000-8000-000000000d11')$$,
  'a note with its through turn is accepted'
);
select lives_ok(
  $$select pg_temp.add_conversation('66400000-0000-4000-8000-0000000000dd', '66400000-0000-4000-8000-000000000d04', 'test', gen_random_uuid())$$,
  'a through turn that is not a turn of the table is accepted, because the column has no foreign key'
);
select throws_ok(
  $$select pg_temp.add_conversation('66400000-0000-4000-8000-0000000000dd', '66400000-0000-4000-8000-000000000d05', 'test', null)$$,
  '23514',
  'new row for relation "assistant_conversations" violates check constraint "assistant_conversations_compaction_check"',
  'a note without a through turn is refused'
);
select throws_ok(
  $$select pg_temp.add_conversation('66400000-0000-4000-8000-0000000000dd', '66400000-0000-4000-8000-000000000d05', null, '66400000-0000-4000-8000-000000000d11')$$,
  '23514',
  'new row for relation "assistant_conversations" violates check constraint "assistant_conversations_compaction_check"',
  'a through turn without a note is refused'
);
select throws_ok(
  $$update public.assistant_conversations set compaction_summary = 'test' where id = '66400000-0000-4000-8000-000000000d01'$$,
  '23514',
  'new row for relation "assistant_conversations" violates check constraint "assistant_conversations_compaction_check"',
  'an update that sets only the note is refused'
);
select lives_ok(
  $$update public.assistant_conversations
    set compaction_summary = null, compacted_through_turn_id = null
    where id = '66400000-0000-4000-8000-000000000d03'$$,
  'an update that clears both columns together is accepted'
);

-- Row level security. A and B each have a conversation with a turn and two messages, and A's
-- conversation has a note.
select lives_ok(
  $$select pg_temp.add_conversation('66400000-0000-4000-8000-0000000000aa', '66400000-0000-4000-8000-000000000a01', 'test', '66400000-0000-4000-8000-000000000a11')$$,
  'a conversation with a note is accepted for user A'
);
select lives_ok(
  $$select pg_temp.add_conversation('66400000-0000-4000-8000-0000000000bb', '66400000-0000-4000-8000-000000000b01', 'test', '66400000-0000-4000-8000-000000000b11')$$,
  'a conversation with a note is accepted for user B'
);
select lives_ok(
  $$select pg_temp.add_turn('66400000-0000-4000-8000-0000000000aa', '66400000-0000-4000-8000-000000000a01', '66400000-0000-4000-8000-000000000a11', 'complete')$$,
  'a turn is accepted for user A'
);
select lives_ok(
  $$select pg_temp.add_turn('66400000-0000-4000-8000-0000000000bb', '66400000-0000-4000-8000-000000000b01', '66400000-0000-4000-8000-000000000b11', 'complete')$$,
  'a turn is accepted for user B'
);
select lives_ok(
  $$select pg_temp.add_message('66400000-0000-4000-8000-0000000000aa', '66400000-0000-4000-8000-000000000a01', '66400000-0000-4000-8000-000000000a11', '66400000-0000-4000-8000-000000000a21', 1, 'user'),
    pg_temp.add_message('66400000-0000-4000-8000-0000000000aa', '66400000-0000-4000-8000-000000000a01', '66400000-0000-4000-8000-000000000a11', '66400000-0000-4000-8000-000000000a22', 2, 'assistant')$$,
  'two messages are accepted for user A'
);
select lives_ok(
  $$select pg_temp.add_message('66400000-0000-4000-8000-0000000000bb', '66400000-0000-4000-8000-000000000b01', '66400000-0000-4000-8000-000000000b11', '66400000-0000-4000-8000-000000000b21', 1, 'user'),
    pg_temp.add_message('66400000-0000-4000-8000-0000000000bb', '66400000-0000-4000-8000-000000000b01', '66400000-0000-4000-8000-000000000b11', '66400000-0000-4000-8000-000000000b22', 2, 'assistant')$$,
  'two messages are accepted for user B'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"66400000-0000-4000-8000-0000000000aa","role":"authenticated"}';

select is(
  (select count(*)::int from public.assistant_conversations
    where user_id in ('66400000-0000-4000-8000-0000000000aa', '66400000-0000-4000-8000-0000000000bb')),
  1,
  'user A selects one conversation out of A and B'
);
select is(
  (select count(*)::int from public.assistant_conversations where id = '66400000-0000-4000-8000-000000000a01'),
  1,
  'user A selects their own conversation by id'
);
select is(
  (select compaction_summary from public.assistant_conversations where id = '66400000-0000-4000-8000-000000000a01'),
  'test',
  'user A reads the note of their own conversation'
);
select is(
  (select count(*)::int from public.assistant_conversations where id = '66400000-0000-4000-8000-000000000b01'),
  0,
  'user A selecting user B''s conversation by id gets no row'
);
select is(
  (select count(*)::int from public.assistant_conversations where compaction_summary is not null and user_id = '66400000-0000-4000-8000-0000000000bb'),
  0,
  'user A cannot find user B''s note by filtering on it'
);
select is(
  (select count(*)::int from public.assistant_turns
    where user_id in ('66400000-0000-4000-8000-0000000000aa', '66400000-0000-4000-8000-0000000000bb')),
  1,
  'user A selects one turn out of A and B'
);
select is(
  (select count(*)::int from public.assistant_turns where id = '66400000-0000-4000-8000-000000000b11'),
  0,
  'user A selecting user B''s turn by id gets no row'
);
select is(
  (select count(*)::int from public.assistant_turns where conversation_id = '66400000-0000-4000-8000-000000000b01'),
  0,
  'user A selecting the turns of user B''s conversation gets no row'
);
select is(
  (select count(*)::int from public.assistant_messages
    where user_id in ('66400000-0000-4000-8000-0000000000aa', '66400000-0000-4000-8000-0000000000bb')),
  2,
  'user A selects two messages out of A and B'
);
select is(
  (select array_agg(seq order by seq) from public.assistant_messages where conversation_id = '66400000-0000-4000-8000-000000000a01'),
  array[1, 2],
  'user A reads their own messages in seq order'
);
select is(
  (select count(*)::int from public.assistant_messages where id in ('66400000-0000-4000-8000-000000000b21', '66400000-0000-4000-8000-000000000b22')),
  0,
  'user A selecting user B''s messages by id gets no row'
);
select is(
  (select count(*)::int from public.assistant_messages where conversation_id = '66400000-0000-4000-8000-000000000b01'),
  0,
  'user A selecting the messages of user B''s conversation gets no row'
);

-- Select and delete of conversations only: every insert and update by an authenticated user is refused
-- at the privilege check, whatever the row, and that includes the note.
select throws_ok(
  $$insert into public.assistant_conversations (user_id) values ('66400000-0000-4000-8000-0000000000aa')$$,
  '42501',
  'permission denied for table assistant_conversations',
  'user A cannot insert a conversation for themselves'
);
select throws_ok(
  $$insert into public.assistant_conversations (user_id) values ('66400000-0000-4000-8000-0000000000bb')$$,
  '42501',
  'permission denied for table assistant_conversations',
  'user A cannot insert a conversation for user B'
);
select throws_ok(
  $$insert into public.assistant_conversations (user_id, compaction_summary, compacted_through_turn_id)
    values ('66400000-0000-4000-8000-0000000000aa', 'test', gen_random_uuid())$$,
  '42501',
  'permission denied for table assistant_conversations',
  'user A cannot insert a conversation with a note'
);
select throws_ok(
  $$update public.assistant_conversations set updated_at = now() where id = '66400000-0000-4000-8000-000000000a01'$$,
  '42501',
  'permission denied for table assistant_conversations',
  'user A cannot update their own conversation'
);
select throws_ok(
  $$update public.assistant_conversations set compaction_summary = 'test', compacted_through_turn_id = gen_random_uuid()
    where id = '66400000-0000-4000-8000-000000000a01'$$,
  '42501',
  'permission denied for table assistant_conversations',
  'user A cannot write the note of their own conversation'
);
select throws_ok(
  $$update public.assistant_conversations set compaction_summary = null, compacted_through_turn_id = null
    where id = '66400000-0000-4000-8000-000000000a01'$$,
  '42501',
  'permission denied for table assistant_conversations',
  'user A cannot clear the note of their own conversation'
);
select throws_ok(
  $$insert into public.assistant_turns (conversation_id, user_id, user_message_id)
    values ('66400000-0000-4000-8000-000000000a01', '66400000-0000-4000-8000-0000000000aa', gen_random_uuid())$$,
  '42501',
  'permission denied for table assistant_turns',
  'user A cannot insert a turn'
);
select throws_ok(
  $$update public.assistant_turns set status = 'failed' where id = '66400000-0000-4000-8000-000000000a11'$$,
  '42501',
  'permission denied for table assistant_turns',
  'user A cannot update their own turn'
);
select throws_ok(
  $$delete from public.assistant_turns where id = '66400000-0000-4000-8000-000000000a11'$$,
  '42501',
  'permission denied for table assistant_turns',
  'user A cannot delete their own turn directly'
);
select throws_ok(
  $$insert into public.assistant_messages (conversation_id, turn_id, user_id, role, content, seq)
    values ('66400000-0000-4000-8000-000000000a01', '66400000-0000-4000-8000-000000000a11', '66400000-0000-4000-8000-0000000000aa', 'user', '[]', 3)$$,
  '42501',
  'permission denied for table assistant_messages',
  'user A cannot insert a message'
);
select throws_ok(
  $$update public.assistant_messages set content = '[]' where id = '66400000-0000-4000-8000-000000000a21'$$,
  '42501',
  'permission denied for table assistant_messages',
  'user A cannot update their own message'
);
select throws_ok(
  $$delete from public.assistant_messages where id = '66400000-0000-4000-8000-000000000a21'$$,
  '42501',
  'permission denied for table assistant_messages',
  'user A cannot delete their own message directly'
);

-- Delete: A cannot delete B's conversation, and the row is still there for B afterwards.
select is(
  pg_temp.affected_rows($$delete from public.assistant_conversations where id = '66400000-0000-4000-8000-000000000b01'$$),
  0::bigint,
  'user A deleting user B''s conversation matches no row'
);
select is(
  pg_temp.affected_rows($$delete from public.assistant_conversations where user_id = '66400000-0000-4000-8000-0000000000bb'$$),
  0::bigint,
  'user A deleting every conversation of user B matches no row'
);

-- B sees their own rows, and cannot see A's conversation, A's note, A's turns or A's messages.
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"66400000-0000-4000-8000-0000000000bb","role":"authenticated"}';

select is(
  (select count(*)::int from public.assistant_conversations where id = '66400000-0000-4000-8000-000000000b01'),
  1,
  'user B selects their own conversation by id'
);
select is(
  (select count(*)::int from public.assistant_conversations where id = '66400000-0000-4000-8000-000000000a01'),
  0,
  'user B selecting user A''s conversation by id gets no row'
);
select is(
  (select compaction_summary from public.assistant_conversations where id = '66400000-0000-4000-8000-000000000a01'),
  null,
  'user B never reads the note of user A''s conversation'
);
select is(
  (select count(*)::int from public.assistant_conversations where compaction_summary is not null and user_id = '66400000-0000-4000-8000-0000000000aa'),
  0,
  'user B cannot find user A''s note by filtering on it'
);
select is(
  (select count(*)::int from public.assistant_turns where id = '66400000-0000-4000-8000-000000000a11'),
  0,
  'user B selecting user A''s turn by id gets no row'
);
select is(
  (select count(*)::int from public.assistant_messages where conversation_id = '66400000-0000-4000-8000-000000000a01'),
  0,
  'user B selecting the messages of user A''s conversation gets no row'
);
select is(
  (select count(*)::int from public.assistant_messages where id in ('66400000-0000-4000-8000-000000000a21', '66400000-0000-4000-8000-000000000a22')),
  0,
  'user B selecting user A''s messages by id gets no row'
);

-- Anon reads nothing and writes nothing.
reset role;
set local role anon;

select throws_ok(
  $$select count(*) from public.assistant_conversations$$,
  '42501',
  'permission denied for table assistant_conversations',
  'anon cannot select from assistant_conversations'
);
select throws_ok(
  $$select count(*) from public.assistant_turns$$,
  '42501',
  'permission denied for table assistant_turns',
  'anon cannot select from assistant_turns'
);
select throws_ok(
  $$select count(*) from public.assistant_messages$$,
  '42501',
  'permission denied for table assistant_messages',
  'anon cannot select from assistant_messages'
);

-- Delete: A deletes their own conversation, and its turn and its two messages go with it. User D's rows
-- and user B's rows stay.
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"66400000-0000-4000-8000-0000000000aa","role":"authenticated"}';

select is(
  pg_temp.affected_rows($$delete from public.assistant_conversations where id = '66400000-0000-4000-8000-000000000a01'$$),
  1::bigint,
  'user A deletes their own conversation'
);
select is(
  (select count(*)::int from public.assistant_turns where id = '66400000-0000-4000-8000-000000000a11'),
  0,
  'the turn of the deleted conversation is gone'
);
select is(
  (select count(*)::int from public.assistant_messages where id in ('66400000-0000-4000-8000-000000000a21', '66400000-0000-4000-8000-000000000a22')),
  0,
  'the messages of the deleted conversation are gone'
);

reset role;

select is(
  (select count(*)::int from public.assistant_conversations where id = '66400000-0000-4000-8000-000000000b01'),
  1,
  'user B''s conversation is still there after user A''s attempts to delete it'
);
select is(
  (select count(*)::int from public.assistant_turns where conversation_id = '66400000-0000-4000-8000-000000000b01'),
  1,
  'user B''s turn is still there'
);
select is(
  (select count(*)::int from public.assistant_messages where conversation_id = '66400000-0000-4000-8000-000000000b01'),
  2,
  'user B''s two messages are still there'
);
select is(
  (select count(*)::int from public.assistant_messages where conversation_id = '66400000-0000-4000-8000-000000000d01'),
  2,
  'user D''s messages are untouched by the delete of user A''s conversation'
);

-- The service role writes, and only inserts, updates and reads. User D has the rows.
set local role service_role;

select lives_ok(
  $$insert into public.assistant_conversations (user_id) values ('66400000-0000-4000-8000-0000000000dd')$$,
  'the service role inserts a conversation'
);
select lives_ok(
  $$update public.assistant_conversations
    set compaction_summary = 'test', compacted_through_turn_id = '66400000-0000-4000-8000-000000000d11', updated_at = now()
    where id = '66400000-0000-4000-8000-000000000d01'$$,
  'the service role writes the note and its through turn together'
);
select is(
  (select compaction_summary from public.assistant_conversations where id = '66400000-0000-4000-8000-000000000d01'),
  'test',
  'the service role reads the note back'
);
select lives_ok(
  $$update public.assistant_turns
    set status = 'confirm', pending_confirmation = '{"tool": "test"}', finished_at = now()
    where id = '66400000-0000-4000-8000-000000000d11'$$,
  'the service role ends a turn with a pending confirmation'
);
select lives_ok(
  $$insert into public.assistant_turns (conversation_id, user_id, user_message_id)
    values ('66400000-0000-4000-8000-000000000d02', '66400000-0000-4000-8000-0000000000dd', gen_random_uuid())$$,
  'the service role inserts a turn'
);
select lives_ok(
  $$insert into public.assistant_messages (conversation_id, turn_id, user_id, role, content, seq)
    values ('66400000-0000-4000-8000-000000000d02', '66400000-0000-4000-8000-000000000d12', '66400000-0000-4000-8000-0000000000dd', 'assistant', '[]', 5)$$,
  'the service role inserts a message'
);
select lives_ok(
  $$update public.assistant_messages set content = '[{"type": "text", "text": "test"}]' where id = '66400000-0000-4000-8000-000000000d21'$$,
  'the service role updates a message'
);
select is(
  (select count(*)::int from public.assistant_messages where conversation_id = '66400000-0000-4000-8000-000000000d01'),
  2,
  'the service role reads the messages of a conversation'
);
select throws_ok(
  $$delete from public.assistant_conversations where id = '66400000-0000-4000-8000-000000000d02'$$,
  '42501',
  'permission denied for table assistant_conversations',
  'the service role cannot delete a conversation'
);
select throws_ok(
  $$delete from public.assistant_turns where id = '66400000-0000-4000-8000-000000000d12'$$,
  '42501',
  'permission denied for table assistant_turns',
  'the service role cannot delete a turn'
);
select throws_ok(
  $$delete from public.assistant_messages where id = '66400000-0000-4000-8000-000000000d21'$$,
  '42501',
  'permission denied for table assistant_messages',
  'the service role cannot delete a message'
);

reset role;

-- The cascade from the auth user. User C has two conversations, and one of them has two turns and three
-- messages. Deleting the auth user removes the rows of all three tables, and user D's rows stay.
select lives_ok(
  $$select pg_temp.add_conversation('66400000-0000-4000-8000-0000000000cc', '66400000-0000-4000-8000-000000000c01', 'test', '66400000-0000-4000-8000-000000000c11'),
    pg_temp.add_conversation('66400000-0000-4000-8000-0000000000cc', '66400000-0000-4000-8000-000000000c02')$$,
  'two conversations are accepted for the account deletion case'
);
select lives_ok(
  $$select pg_temp.add_turn('66400000-0000-4000-8000-0000000000cc', '66400000-0000-4000-8000-000000000c01', '66400000-0000-4000-8000-000000000c11', 'complete'),
    pg_temp.add_turn('66400000-0000-4000-8000-0000000000cc', '66400000-0000-4000-8000-000000000c01', '66400000-0000-4000-8000-000000000c12', 'stopped')$$,
  'two turns are accepted for the account deletion case'
);
select lives_ok(
  $$select pg_temp.add_message('66400000-0000-4000-8000-0000000000cc', '66400000-0000-4000-8000-000000000c01', '66400000-0000-4000-8000-000000000c11', '66400000-0000-4000-8000-000000000c21', 1, 'user'),
    pg_temp.add_message('66400000-0000-4000-8000-0000000000cc', '66400000-0000-4000-8000-000000000c01', '66400000-0000-4000-8000-000000000c11', '66400000-0000-4000-8000-000000000c22', 2, 'assistant'),
    pg_temp.add_message('66400000-0000-4000-8000-0000000000cc', '66400000-0000-4000-8000-000000000c01', '66400000-0000-4000-8000-000000000c12', '66400000-0000-4000-8000-000000000c23', 3, 'user')$$,
  'three messages are accepted for the account deletion case'
);
select lives_ok(
  $$delete from auth.users where id = '66400000-0000-4000-8000-0000000000cc'$$,
  'deleting an auth user with conversations succeeds'
);
select is(
  (select count(*)::int from public.assistant_conversations where user_id = '66400000-0000-4000-8000-0000000000cc'),
  0,
  'the conversations of the deleted user are gone'
);
select is(
  (select count(*)::int from public.assistant_turns where user_id = '66400000-0000-4000-8000-0000000000cc'),
  0,
  'the turns of the deleted user are gone'
);
select is(
  (select count(*)::int from public.assistant_messages where user_id = '66400000-0000-4000-8000-0000000000cc'),
  0,
  'the messages of the deleted user are gone'
);
select is(
  (select count(*)::int from public.assistant_conversations where id in ('66400000-0000-4000-8000-000000000d01', '66400000-0000-4000-8000-000000000d02')),
  2,
  'the conversations of another user are untouched by the deletion'
);

select * from finish();

rollback;
