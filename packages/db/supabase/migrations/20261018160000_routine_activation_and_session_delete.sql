-- routine activation date and atomic session delete (KEY-378). It adds `routines.activated_at`, the
-- trigger that stamps it, the function `delete_workout_session`, and a trigger that keeps a set out
-- of a deleted session. All of it is set out in docs/adr/0005-training-v1.md, Amendment 2. The
-- migration adds a nullable column, two triggers with their functions and a function, and touches
-- no grant, policy or row that exists.
--
-- Health data: nothing here raises a notice or an error that quotes a value.

-- The day a routine last became the active one. A newly active routine plans from this day, so the
-- days of the week before the switch do not read as missed. It is null until the routine is first
-- activated. It has no grant, so a client reads it (the table-wide select covers it) and can never
-- write it: the update grant on `routines` lists its columns, and this one is not among them. The
-- trigger below is the only writer.
alter table public.routines add column activated_at timestamptz;

-- Stamps `activated_at` with now() when `is_active` goes from false to true, whatever value the
-- statement sent for the column. The `when` clause on the trigger keeps every other update away
-- from it, so deactivating a routine keeps the old date and an update of the name alone never
-- touches it. The next activation overwrites it.
--
-- Security invoker, since it only assigns to the row it is given. The empty search_path forces
-- every reference to be schema-qualified.
create function public.routines_stamp_activated_at()
returns trigger
language plpgsql
volatile
security invoker
set search_path = ''
as $$
begin
  new.activated_at := pg_catalog.now();
  return new;
end;
$$;

-- Only the trigger runs this function, and firing a trigger needs no execute privilege, so nobody
-- holds it. `create function` grants execute to public and the Supabase default ACL grants it to
-- the API roles, so each is revoked by name.
revoke execute on function public.routines_stamp_activated_at() from public, anon, authenticated, service_role;

create trigger routines_stamp_activated_at
  before update on public.routines
  for each row
  when (new.is_active and not old.is_active)
  execute function public.routines_stamp_activated_at();

-- Deletes the caller's session and its sets in one transaction, so the heat read, which reads
-- `workout_sets`, never counts the sets of a deleted session. Sessions and sets are soft deleted and
-- a set carries no flag of its session, so a client that soft deleted the session alone, or whose
-- second call failed, would leave ghost sets behind.
--
-- The session is soft deleted with the transaction's time, and so is every set of it that is still
-- live. A set deleted earlier keeps its earlier stamp. A null id raises 22023. A session that does
-- not exist, is not the caller's or is already deleted raises P0002, and the three cases look the
-- same. Messages state the rule and quote no value.
--
-- Security invoker, so the owner-only policies and the column grants of 20261018130000 apply to
-- both writes. The session row is locked first, so the call waits for a set that another
-- transaction is logging against the session, and stamps that set with the rest. A set written
-- after this call has locked the row waits for it and is then refused by the trigger below, so no
-- live set is left behind.
create function public.delete_workout_session(p_session_id uuid)
returns void
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  stamp timestamptz := pg_catalog.now();
begin
  if p_session_id is null then
    raise exception 'a session id is required'
      using errcode = '22023';
  end if;

  perform 1
  from public.workout_sessions s
  where s.id = p_session_id and s.user_id = caller and s.deleted_at is null
  for update;

  if not found then
    raise exception 'the session does not exist, is not yours or is already deleted'
      using errcode = 'P0002';
  end if;

  -- The order of the two writes does not matter to the rule, because the trigger below ignores a
  -- write that sets `deleted_at`. The sets go first so that the session, which history reads, is the
  -- last row to change.
  update public.workout_sets
  set deleted_at = stamp
  where session_id = p_session_id and user_id = caller and deleted_at is null;

  update public.workout_sessions
  set deleted_at = stamp
  where id = p_session_id;
end;
$$;

revoke execute on function public.delete_workout_session(uuid) from public, anon, service_role;
grant execute on function public.delete_workout_session(uuid) to authenticated;

-- A set is written only into a live session. Without this, a set inserted while a delete is still
-- in flight, or a set revived behind a deleted session, would be a live set that heat counts while
-- its session is gone. The policies of 20261018130000 check that the session is the caller's and
-- not that it is live, and a policy cannot close the gap: its subquery reads the snapshot the
-- statement started with, so an insert that began before a delete committed would pass the check,
-- then wait on the foreign key's lock and complete after the commit.
--
-- A trigger can lock instead. It takes a key share lock on the session row, which waits for a
-- delete that holds the row and then re-reads the row as the delete left it, so a deleted session is
-- not found. It fires for an insert and for an update of `deleted_at`, and only when the new row is
-- live, so stamping a set as deleted (the delete function, the history client) is never held up,
-- and restoring a session first makes its sets revivable again. The refusal is 42501, the code a
-- policy refusal has, and the message states the rule. The reads run as the caller under the
-- owner-only policies of `workout_sessions`, so the trigger only ever speaks about the caller's own
-- session. A session that does not exist or is not the caller's is refused by the insert policy of
-- 20261018130000 with its own message, as before.
--
-- Security invoker, with an empty search_path. Only the trigger runs the function, so nobody holds
-- `execute` on it.
create function public.workout_sets_require_live_session()
returns trigger
language plpgsql
volatile
security invoker
set search_path = ''
as $$
begin
  perform 1
  from public.workout_sessions s
  where s.id = new.session_id and s.deleted_at is null
  for key share;

  -- A session the caller cannot see, or that does not exist, is left to the insert policy and the
  -- foreign key, which refuse it as they did before. Only a visible session that is deleted is
  -- refused here. This second read is a new statement, so it sees a delete that committed while the
  -- lock above waited.
  if not found and exists (select 1 from public.workout_sessions s where s.id = new.session_id) then
    raise exception 'a set can only be written into a live session'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke execute on function public.workout_sets_require_live_session() from public, anon, authenticated, service_role;

create trigger workout_sets_require_live_session
  before insert or update of deleted_at on public.workout_sets
  for each row
  when (new.deleted_at is null)
  execute function public.workout_sets_require_live_session();
