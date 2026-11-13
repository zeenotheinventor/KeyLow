-- Asserts the two checks that ADR 0003, Amendment 22 widens for the kitchen: assistant_messages.role
-- accepts `system`, and assistant_usage.route accepts `recipe_generate` and `plan_generate`. The values
-- that were already allowed still are, and a value nobody named is still refused.
--
-- `supabase test db` runs this file as postgres inside a transaction that is rolled back, so nothing
-- created here persists. Every fixture id starts with 10160000 and the email with key1016-. The rows
-- hold a made up word and zero counts, no health value.

begin;

select plan(14);

insert into auth.users (instance_id, id, aud, role, email) values
  ('00000000-0000-0000-0000-000000000000', '10160000-0000-4000-8000-0000000000aa', 'authenticated', 'authenticated', 'key1016-widening@keylow.test');

insert into public.assistant_conversations (id, user_id)
values ('10160000-0000-4000-8000-000000000a01', '10160000-0000-4000-8000-0000000000aa');

insert into public.assistant_turns (id, conversation_id, user_id, user_message_id)
values (
  '10160000-0000-4000-8000-000000000a11',
  '10160000-0000-4000-8000-000000000a01',
  '10160000-0000-4000-8000-0000000000aa',
  gen_random_uuid()
);

create function pg_temp.add_message(message_seq integer, message_role text)
returns void
language sql
as $$
  insert into public.assistant_messages (conversation_id, turn_id, user_id, role, content, seq)
  values (
    '10160000-0000-4000-8000-000000000a01',
    '10160000-0000-4000-8000-000000000a11',
    '10160000-0000-4000-8000-0000000000aa',
    message_role,
    '[{"type": "text", "text": "test"}]',
    message_seq
  )
$$;

create function pg_temp.add_usage(usage_route text)
returns void
language sql
as $$
  insert into public.assistant_usage (
    user_id, turn_id, route, model, input_tokens, output_tokens, cache_read_input_tokens,
    cache_creation_input_tokens, cost_usd_micros, latency_ms, transport
  )
  values (
    '10160000-0000-4000-8000-0000000000aa', '10160000-0000-4000-8000-000000000a11', usage_route,
    'test-model', 0, 0, 0, 0, 0, 0, 'none'
  )
$$;

-- assistant_messages.role.
select lives_ok($$select pg_temp.add_message(1, 'user')$$, 'the role user is still accepted');
select lives_ok($$select pg_temp.add_message(2, 'assistant')$$, 'the role assistant is still accepted');
select lives_ok($$select pg_temp.add_message(3, 'system')$$, 'the role system is accepted');
select throws_ok(
  $$select pg_temp.add_message(4, 'tool')$$,
  '23514',
  'new row for relation "assistant_messages" violates check constraint "assistant_messages_role_check"',
  'a role outside the three is refused'
);

-- assistant_usage.route.
select lives_ok($$select pg_temp.add_usage('describe_or_ask')$$, 'the route describe_or_ask is still accepted');
select lives_ok($$select pg_temp.add_usage('compact')$$, 'the route compact is still accepted');
select lives_ok($$select pg_temp.add_usage('recipe_parse')$$, 'the route recipe_parse is still accepted');
select lives_ok($$select pg_temp.add_usage('recipe_generate')$$, 'the route recipe_generate is accepted');
select lives_ok($$select pg_temp.add_usage('plan_generate')$$, 'the route plan_generate is accepted');
select throws_ok(
  $$select pg_temp.add_usage('coaching')$$,
  '23514',
  'new row for relation "assistant_usage" violates check constraint "assistant_usage_route_check"',
  'a route outside the five is refused'
);

-- The checks keep their names, so every other test and tool that names them still finds them.
select is(
  (select count(*)::int from pg_constraint
    where conrelid = 'public.assistant_messages'::regclass and conname = 'assistant_messages_role_check'),
  1,
  'assistant_messages_role_check exists once'
);
select is(
  (select count(*)::int from pg_constraint
    where conrelid = 'public.assistant_usage'::regclass and conname = 'assistant_usage_route_check'),
  1,
  'assistant_usage_route_check exists once'
);
select is(
  (select pg_get_constraintdef(oid) from pg_constraint
    where conrelid = 'public.assistant_messages'::regclass and conname = 'assistant_messages_role_check'),
  $$CHECK ((role = ANY (ARRAY['user'::text, 'assistant'::text, 'system'::text])))$$,
  'the role check lists user, assistant and system and nothing else'
);
select is(
  (select pg_get_constraintdef(oid) from pg_constraint
    where conrelid = 'public.assistant_usage'::regclass and conname = 'assistant_usage_route_check'),
  $$CHECK ((route = ANY (ARRAY['describe_or_ask'::text, 'compact'::text, 'recipe_parse'::text, 'recipe_generate'::text, 'plan_generate'::text])))$$,
  'the route check lists the five routes and nothing else'
);

select * from finish();

rollback;
