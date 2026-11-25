-- Account deletion (ADR 0003, Amendment 28): when an auth user is hard deleted, also purge what has
-- no foreign key to the user. Every one of the 39 user-owned tables already goes through
-- `on delete cascade`. Two places do not: `public.rate_limits`, whose per-user buckets are text keys
-- that end in the user id, and `auth.audit_log_entries`, which keeps the user's id and email in a
-- json payload.
--
-- The migration inserts and deletes no row, so it applies to a database holding any data.

-- This trigger runs inside every deletion of an auth user. If it raised, every deletion would fail,
-- so a missing privilege has to stop the deploy here and never a person's deletion later.
do $$
begin
  if not has_table_privilege(current_user, 'public.rate_limits', 'DELETE') then
    raise exception 'the role applying this migration needs DELETE on public.rate_limits';
  end if;
  if not has_table_privilege(current_user, 'auth.audit_log_entries', 'SELECT')
    or not has_table_privilege(current_user, 'auth.audit_log_entries', 'DELETE') then
    raise exception 'the role applying this migration needs SELECT and DELETE on auth.audit_log_entries';
  end if;
end;
$$;

-- Every per-user bucket name ends in `:<user id>` (off-search:user:<id>, off-product:user:<id>,
-- assistant:turns:<id>, delete-account:user:<id>) and a global bucket ends in `:global`. A uuid holds
-- no `%` or `_`, so the pattern is exact on the id and cannot match a global bucket or another user.
--
-- The audit log holds the id as `actor_id` on sign-in and token entries, and as `traits.user_id` on
-- the `user_deleted` entry. The payload is json with no index, so this is one sequential scan of the
-- log per deletion, which is accepted at this scale.
--
-- security definer, because GoTrue deletes the user as supabase_auth_admin, which holds no privilege
-- on rate_limits (the same reason exercise_has_primary_muscle() is security definer). Nothing else is
-- deleted here, and a soft delete is an update, so it does not fire the trigger.
create function public.purge_deleted_user_traces()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.rate_limits where bucket like '%:' || old.id::text;

  delete from auth.audit_log_entries
  where payload ->> 'actor_id' = old.id::text
    or payload -> 'traits' ->> 'user_id' = old.id::text;

  return old;
end;
$$;

-- Firing a trigger needs no execute privilege, so nobody gets any.
revoke execute on function public.purge_deleted_user_traces() from public, anon, authenticated, service_role;

create trigger on_auth_user_deleted_purge_traces
after delete on auth.users
for each row execute function public.purge_deleted_user_traces();
