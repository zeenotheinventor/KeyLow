-- assistant_actions_and_usage: the `assistant_actions` and `assistant_usage` tables, the view
-- `assistant_usage_daily` and the function `assistant_spend_this_month()`, readable by their owner and
-- written only by the service role (KEY-665).
-- Everything here is set out in docs/adr/0003-data-model.md, Amendment 14, which wins over any other
-- description. The conversations are the migration before this one, the entitlements and the consent
-- columns are the one after it, and the function that writes these rows is its own ticket.
--
-- Neither table holds a health value. An action holds ids and one diary date, and a usage row holds
-- counts, so no column can hold a nutrient, a weight, a quantity or free text beyond the tool name, the
-- table name, the route, the model id, the stop reason and the transport. The migration inserts no row,
-- so it applies to a database that holds any data.

-- One write tool call of the assistant. The ten slots of a turn count tool calls and not rows, so
-- `turn_seq` runs from 1 to 10 with one per call, and the unique key and the check below are what the
-- executor's reservation relies on: parallel writes cannot take the same slot or an eleventh. A row with
-- `target_id`, `target_ids` and `target_local_date` all null is a reserved slot, and the executor deletes
-- it when the write fails. The database has no marker for a landed write, so nothing checks that one of
-- the three is set. `target_id` has no foreign key because it names rows of different tables, and
-- `day_logs` has no id, so a diary day is named by `target_local_date`. `conversation_id` and `turn_id`
-- are set null when their row goes, so "What the assistant changed" keeps the action after the
-- conversation is deleted. `user_id` has no default, because no client inserts.
create table public.assistant_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  conversation_id uuid references public.assistant_conversations (id) on delete set null,
  turn_id uuid references public.assistant_turns (id) on delete set null,
  turn_seq integer not null,
  tool text not null,
  target_table text not null,
  target_id uuid,
  target_ids uuid[],
  target_local_date date,
  target_updated_at timestamptz,
  created_at timestamptz not null default now(),
  undone_at timestamptz,

  constraint assistant_actions_turn_seq_check check (turn_seq between 1 and 10),

  -- Null, or at least one id. An empty list would say a multi-row write changed nothing.
  constraint assistant_actions_target_ids_check check (target_ids is null or cardinality(target_ids) > 0),

  -- The slot key. It leads with `turn_id`, so it also serves that foreign key. A null turn is never equal
  -- to another, so the actions of deleted turns can share a slot number.
  constraint assistant_actions_turn_id_turn_seq_key unique (turn_id, turn_seq)
);

-- The changes list of a person, newest first, and the cascade from `auth.users`. The second index serves
-- the set null when a conversation is deleted.
create index assistant_actions_user_id_created_at_idx
  on public.assistant_actions (user_id, created_at desc);
create index assistant_actions_conversation_id_idx on public.assistant_actions (conversation_id);

-- One model call. A turn with three tool rounds writes four rows. `turn_id` has no foreign key and is not
-- null, because a key that cascaded or set null would let a person lower the month's spend by deleting a
-- conversation. A compaction call carries the id of the turn it followed. `transport` is `mcp_http` for
-- the model calls of a turn and `none` for a compaction call and a recipe parse call, which use no tools.
-- The coaching wave adds its own route in its own amendment.
create table public.assistant_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  turn_id uuid not null,
  route text not null,
  model text not null,
  input_tokens integer not null,
  output_tokens integer not null,
  cache_read_input_tokens integer not null,
  cache_creation_input_tokens integer not null,
  cost_usd_micros bigint not null,
  latency_ms integer not null,
  stop_reason text,
  transport text not null,
  created_at timestamptz not null default now(),

  constraint assistant_usage_route_check check (route in ('describe_or_ask', 'compact', 'recipe_parse')),
  constraint assistant_usage_transport_check check (transport in ('mcp_http', 'none')),
  constraint assistant_usage_input_tokens_check check (input_tokens >= 0),
  constraint assistant_usage_output_tokens_check check (output_tokens >= 0),
  constraint assistant_usage_cache_read_input_tokens_check check (cache_read_input_tokens >= 0),
  constraint assistant_usage_cache_creation_input_tokens_check check (cache_creation_input_tokens >= 0),
  constraint assistant_usage_cost_usd_micros_check check (cost_usd_micros >= 0),
  constraint assistant_usage_latency_ms_check check (latency_ms >= 0)
);

-- The daily view and the cascade from `auth.users`, and the monthly sum over every person.
create index assistant_usage_user_id_created_at_idx on public.assistant_usage (user_id, created_at);
create index assistant_usage_created_at_idx on public.assistant_usage (created_at);

alter table public.assistant_actions enable row level security;
alter table public.assistant_usage enable row level security;

-- Set the table privileges explicitly so nothing relies on the default ones (see 0001_init.sql).
-- Start from a clean slate, then grant back only what is needed. A client can read and cannot write, so it
-- cannot write an action or a usage row, or lower its own cost. The service role reserves, fills in,
-- releases and reads actions, and only inserts usage. The anon role keeps nothing.
revoke all on public.assistant_actions from anon, authenticated, service_role;
revoke all on public.assistant_usage from anon, authenticated, service_role;

grant select on public.assistant_actions to authenticated;
grant select on public.assistant_usage to authenticated;
grant select, insert, update, delete on public.assistant_actions to service_role;
grant insert on public.assistant_usage to service_role;

-- Owner only. Both tables carry `user_id`, so no policy joins. Terms acceptance is not in these policies
-- (Amendment 9, "Privileges and row level security").
create policy "assistant_actions_select_own" on public.assistant_actions
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "assistant_usage_select_own" on public.assistant_usage
  for select to authenticated
  using (user_id = (select auth.uid()));

-- Per person and UTC day: the distinct turns that asked the model (compaction and recipe parse rows add
-- tokens and cost and no turn) and the sums of the counts. The sums are cast to bigint, which keeps them
-- whole numbers (the sum of a bigint is a numeric). `security_invoker` makes the view run with the
-- caller's privileges, so the owner-only policy on `assistant_usage` filters it, and the view needs no
-- policy of its own. A person reads their own days and nobody else's.
create view public.assistant_usage_daily
with (security_invoker = true) as
select
  user_id,
  (created_at at time zone 'utc')::date as usage_date,
  count(distinct turn_id) filter (where route = 'describe_or_ask') as turns,
  sum(input_tokens)::bigint as input_tokens,
  sum(output_tokens)::bigint as output_tokens,
  sum(cache_read_input_tokens)::bigint as cache_read_input_tokens,
  sum(cache_creation_input_tokens)::bigint as cache_creation_input_tokens,
  sum(cost_usd_micros)::bigint as cost_usd_micros
from public.assistant_usage
group by user_id, (created_at at time zone 'utc')::date;

-- A person reads the view and does nothing else with it. The service role has no grant on it.
revoke all on public.assistant_usage_daily from anon, authenticated, service_role;
grant select on public.assistant_usage_daily to authenticated;

-- The cost of every person since the first instant of the current month in UTC, in millionths of a US
-- dollar, and 0 when there is no row. It is `security definer` because the service role cannot read
-- `assistant_usage`, and its `search_path` is empty, so it names every object with its schema. The month
-- is cut in UTC whatever the session's time zone is.
create function public.assistant_spend_this_month()
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(cost_usd_micros), 0)::bigint
  from public.assistant_usage
  where created_at >= date_trunc('month', now() at time zone 'utc') at time zone 'utc'
$$;

-- Only the service role may execute it. Revoking from `public` alone would leave the explicit grants that
-- Supabase's default privileges give `anon` and `authenticated`.
revoke execute on function public.assistant_spend_this_month() from public, anon, authenticated;
grant execute on function public.assistant_spend_this_month() to service_role;
