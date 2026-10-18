-- One session in progress per user (ADR 0005, Amendment 3, KEY-386). A session is in progress while
-- `ended_at` is null and it is not soft deleted, and a user may have one at a time. Before this,
-- two devices starting a session at once could both insert, and the client's read-then-insert
-- could not prevent it. The migration closes any duplicates that already exist, then adds the
-- partial unique index that makes a second one impossible. It touches no grant, policy or function.
--
-- Health data: nothing here raises a notice or an error that quotes a value. A second session in
-- progress is refused by the index with the code 23505, and the index name states the rule.

-- Stops a session in progress from starting between the update below and the index build, which
-- would make the build fail on a duplicate that arrived after the update. The lock blocks inserts
-- and updates on the table until the commit, and plain reads go on. A lock lasts to the end of a
-- transaction and the CLI does not wrap a migration file in one, so the file opens its own.
begin;

lock table public.workout_sessions in share row exclusive mode;

-- Closes the duplicates the index would refuse. Per user it keeps the newest session in progress,
-- by `started_at` and then by `id` for two that started at the same moment, and ends each older
-- one at its last live set, or at its own `started_at` when it has none.
--
-- That end is true to the data: a session that was never finished has no real end, and the moment
-- of its last set is the latest time anything shows it was still going, so history shows how long
-- the training lasted and not 0 minutes. A session with no sets ends at its `started_at`, which
-- adds no time that was not logged. `now()` would make a session from last month run until today,
-- and could move its end into a later week than its start. `greatest` keeps the end from falling
-- before the start, which `workout_sessions_ended_after_started` would refuse, for a set logged
-- with a time earlier than the session's start. Soft deleted sets do not count. Nothing is deleted,
-- and every session keeps its sets, its note and its day. Running the update again changes no row.
update public.workout_sessions as older
set ended_at = greatest(
  older.started_at,
  coalesce(
    (
      select max(logged.performed_at)
      from public.workout_sets as logged
      where logged.session_id = older.id
        and logged.deleted_at is null
    ),
    older.started_at
  )
)
where older.ended_at is null
  and older.deleted_at is null
  and exists (
    select 1
    from public.workout_sessions as newer
    where newer.user_id = older.user_id
      and newer.ended_at is null
      and newer.deleted_at is null
      and (newer.started_at, newer.id) > (older.started_at, older.id)
  );

-- The rule. The index is partial, so a finished or deleted session never takes part in it, and a
-- user can have as many of those as they like next to one in progress. Restoring a deleted session
-- that was in progress while another one is in progress is refused by the index too.
create unique index workout_sessions_one_open_per_user
  on public.workout_sessions (user_id)
  where ended_at is null and deleted_at is null;

commit;
