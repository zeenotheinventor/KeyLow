-- assistant_conversations: the `assistant_conversations`, `assistant_turns` and `assistant_messages`
-- tables, readable by their owner, deletable only as a whole conversation, and written only by the
-- service role (KEY-664).
-- Everything here is set out in docs/adr/0003-data-model.md, Amendment 14, which wins over any other
-- description. The tables that record actions, usage and access are other migrations, and so is the
-- function that writes these rows.
--
-- These are health data tables. A message holds what a person typed and what the tools returned, and the
-- compaction note holds foods and amounts. Nothing here logs a row value or raises a notice with one.
-- A check constraint failure can quote the failing row in PostgreSQL's own error log, which no client can
-- prevent (Amendment 9, "Health data"), and no client can insert or update these tables in any case.
-- The migration inserts no row, so it applies to a database that holds any data.

-- One running conversation per person in M8, though the table allows many. `user_id` has no default,
-- because no client inserts. `title` is never written in M8, so it is always null. The note and the
-- turn it runs up to are written together by the service role at compaction and are null until then.
-- `compacted_through_turn_id` has no foreign key: a turn only goes when its conversation goes, and a key
-- from conversations to turns would make the two tables reference each other. `updated_at` has no
-- trigger, because no helper exists, so the writer sets it when it stores a turn or a note.
create table public.assistant_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text,
  compaction_summary text,
  compacted_through_turn_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Null together or set together. The two sides are never null themselves, so a mixed row is false.
  constraint assistant_conversations_compaction_check check (
    (compaction_summary is null) = (compacted_through_turn_id is null)
  )
);

-- Finds the newest conversation of a person, and serves the cascade from `auth.users`.
create index assistant_conversations_user_id_updated_at_idx
  on public.assistant_conversations (user_id, updated_at desc);

-- One turn of the loop. `status` is text with a check and not an enum. `user_message_id` names the
-- message that started the turn and has no foreign key, because that message names this turn and a key
-- each way would make the tables reference each other. The writer stores the turn first and the message
-- after it. `pending_confirmation` holds an id, a tool name and a hash, never a health value.
create table public.assistant_turns (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.assistant_conversations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  user_message_id uuid not null,
  status text not null default 'open',
  pending_confirmation jsonb,
  created_at timestamptz not null default now(),
  finished_at timestamptz,

  constraint assistant_turns_status_check check (
    status in ('open', 'complete', 'clarify', 'confirm', 'stopped', 'failed', 'refused')
  )
);

-- For the turns of a conversation in order, and it serves the cascade from a conversation. The second
-- index serves the cascade from `auth.users`.
create index assistant_turns_conversation_id_created_at_idx
  on public.assistant_turns (conversation_id, created_at);
create index assistant_turns_user_id_idx on public.assistant_turns (user_id);

-- One message of a conversation, as the Messages API content blocks, so the next turn replays history
-- unchanged. `seq` is the place in the conversation, from 1, and the writer assigns it. Replays read in
-- `seq` order and never in `created_at` order, because one transaction can store several messages with
-- the same time.
create table public.assistant_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.assistant_conversations (id) on delete cascade,
  turn_id uuid not null references public.assistant_turns (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null,
  content jsonb not null,
  seq integer not null,
  created_at timestamptz not null default now(),

  constraint assistant_messages_role_check check (role in ('user', 'assistant')),

  -- The ordering index. It leads with `conversation_id`, so it also serves that foreign key.
  constraint assistant_messages_conversation_id_seq_key unique (conversation_id, seq)
);

-- So that deleting a turn does not scan the table, and for the cascade from `auth.users`.
create index assistant_messages_turn_id_idx on public.assistant_messages (turn_id);
create index assistant_messages_user_id_idx on public.assistant_messages (user_id);

alter table public.assistant_conversations enable row level security;
alter table public.assistant_turns enable row level security;
alter table public.assistant_messages enable row level security;

-- Set the table privileges explicitly so nothing relies on the default ones (see 0001_init.sql).
-- Start from a clean slate, then grant back only what is needed. A client can read, and can delete a
-- whole conversation, which takes its turns and messages with it by the cascade (a foreign key action
-- does not run as the caller, so turns and messages need no delete grant). A client cannot insert or
-- update anything, so it cannot write a turn, a message or the compaction note. The service role
-- writes and never deletes. The anon role keeps nothing.
revoke all on public.assistant_conversations from anon, authenticated, service_role;
revoke all on public.assistant_turns from anon, authenticated, service_role;
revoke all on public.assistant_messages from anon, authenticated, service_role;

grant select, delete on public.assistant_conversations to authenticated;
grant select on public.assistant_turns to authenticated;
grant select on public.assistant_messages to authenticated;
grant select, insert, update on public.assistant_conversations to service_role;
grant select, insert, update on public.assistant_turns to service_role;
grant select, insert, update on public.assistant_messages to service_role;

-- Owner only. Every table carries `user_id`, so no policy joins. Terms acceptance is not in these
-- policies (Amendment 9, "Privileges and row level security").
create policy "assistant_conversations_select_own" on public.assistant_conversations
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "assistant_conversations_delete_own" on public.assistant_conversations
  for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "assistant_turns_select_own" on public.assistant_turns
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "assistant_messages_select_own" on public.assistant_messages
  for select to authenticated
  using (user_id = (select auth.uid()));
