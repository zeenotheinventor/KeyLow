-- Accepted suggestions: the fourth training migration (KEY-397). A suggestion the user accepts into
-- a day counts as planned in the projected week (ADR 0005, "Projected against actual"), and no table
-- stored one. This adds `accepted_suggestions`, a small table of its own, because writing the added
-- sets into `routine_exercises` would change the user's routine for every week, and an accepted
-- suggestion is for one day and can be undone. Everything here is set out in
-- docs/adr/0005-training-v1.md, Amendment 4, which wins over any other description.
--
-- A suggestion is health data under the project's Working conventions, because the exercises, sets
-- and muscle reasons in it reveal how a person trains. Nothing here logs a row value, and no check
-- or error quotes a name, a set count or a muscle value. A check names the rule it enforces, and
-- no client reads, logs or reports the detail of a database error from a training write.
--
-- The migration is additive. It touches no table, type, function, grant or policy that existed before
-- it.

-- One accepted suggestion. `local_date` is the day it was accepted into, in the user's zone, the
-- calendar day the projected week places it on. `routine_day_id` is the routine day it was folded
-- into, and is null when it stands alone, or after the user removes that day from the routine (the
-- row is kept either way). `exercises` is the plan: the exercises with their target sets, rep range,
-- target RIR and a set snapshot each. Core owns that shape
-- (`acceptedSuggestionSchema`), so the table checks only that it is an array of 1 to 30 objects.
-- `reasons` is the reasons as data, the muscle ids and the numbers behind them, so a suggestion the
-- user took keeps its reasons when the goal changes later. `params_version` names the training
-- params the suggestion was made with. Undo and an accept over an earlier one soft delete the row,
-- as a session is soft deleted, so a mistake can be undone.
create table public.accepted_suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  local_date date not null,
  routine_day_id uuid references public.routine_days (id) on delete set null,
  exercises jsonb not null,
  reasons jsonb not null,
  params_version text not null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),

  -- Three checks on one column, each breaking on one rule only, so the constraint name in a refusal
  -- states the rule. The two that read the array say nothing about a value that is not an array, and
  -- leave it to the first. A `case` makes sure `jsonb_array_length` and the path query never see a
  -- value they cannot take, because SQL gives no order to the parts of an `and`. The path is strict,
  -- because the default lax mode unwraps an array inside the array and would let `[[{}]]` through as
  -- an object.
  constraint accepted_suggestions_exercises_is_array
    check (pg_catalog.jsonb_typeof(exercises) = 'array'),
  constraint accepted_suggestions_exercises_count_check
    check (
      case
        when pg_catalog.jsonb_typeof(exercises) = 'array'
          then pg_catalog.jsonb_array_length(exercises) between 1 and 30
        else true
      end
    ),
  constraint accepted_suggestions_exercises_are_objects
    check (
      case
        when pg_catalog.jsonb_typeof(exercises) = 'array'
          then not pg_catalog.jsonb_path_exists(exercises, 'strict $[*] ? (@.type() != "object")')
        else true
      end
    ),
  constraint accepted_suggestions_reasons_is_object check (pg_catalog.jsonb_typeof(reasons) = 'object')
);

-- One live accepted suggestion per user and day. Accepting again for the same day, or after an Undo,
-- soft deletes the old row first in the client, and the partial index refuses a second live row
-- however it is written. It also refuses restoring a deleted row while another is live for the day.
create unique index accepted_suggestions_one_live_per_user_day
  on public.accepted_suggestions (user_id, local_date)
  where deleted_at is null;

-- The partial index above holds live rows only. This one reads a user's days with their undone
-- rows, and serves the cascade from `auth.users`, which looks up `user_id = $1` over every row.
create index accepted_suggestions_user_id_local_date_idx
  on public.accepted_suggestions (user_id, local_date);

-- The set null when a routine day is removed, which looks up `routine_day_id = $1`.
create index accepted_suggestions_routine_day_id_idx
  on public.accepted_suggestions (routine_day_id);

alter table public.accepted_suggestions enable row level security;

-- Set the table privileges explicitly so nothing relies on the default ones (see 0001_init.sql).
-- Start from a clean slate, then grant back only what Amendment 4 lists. The anon role keeps
-- nothing. The service role keeps nothing either, because nothing server side reads this table yet
-- (the M7 export grants what it needs then). A column added later is not writable by a client until a
-- migration grants it.
--
-- `id`, `created_at` and `deleted_at` are never written on insert, so every new row has the
-- database's id and time and is live. A suggestion never moves to another day, user or planned day,
-- and its exercises, reasons and params version are never rewritten. It is only undone and restored,
-- through the update grant. There is no delete grant on a table whose rows are soft deleted. Account
-- deletion cascades regardless, because a foreign key action does not run as the caller.
revoke all on public.accepted_suggestions from anon, authenticated, service_role;

grant select on public.accepted_suggestions to authenticated;

grant insert (user_id, local_date, routine_day_id, exercises, reasons, params_version)
  on public.accepted_suggestions to authenticated;

grant update (deleted_at) on public.accepted_suggestions to authenticated;

-- `(select auth.uid())` is evaluated once per statement instead of once per row. Soft deleted rows
-- stay visible to their owner, and the clients filter on them.
create policy "accepted_suggestions_select_own" on public.accepted_suggestions
  for select to authenticated
  using (user_id = (select auth.uid()));

-- A foreign key is checked without row level security, so on its own it would let a user fold a
-- suggestion into another user's routine day, and that user's edit of their routine would then clear
-- it. The `exists` runs as the caller under the owner-only `routine_days` policy, so a day that does
-- not exist fails the same way as one that is not theirs.
create policy "accepted_suggestions_insert_own" on public.accepted_suggestions
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (
      routine_day_id is null
      or exists (select 1 from public.routine_days d where d.id = accepted_suggestions.routine_day_id)
    )
  );

create policy "accepted_suggestions_update_own" on public.accepted_suggestions
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
