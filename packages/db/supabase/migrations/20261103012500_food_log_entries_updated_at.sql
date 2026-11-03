-- food_log_entries.updated_at: the time an entry last changed (KEY-688, ADR 0003 Amendment 14, addendum
-- of 2026-11-03).
-- The assistant's Undo of a log, a delete or an edit must know whether the person changed the entry
-- after the assistant did. `assistant_actions` keeps ids and one instant, never a value, so the
-- entry itself has to say when it last changed, and until now nothing on it did (Amendment 1: no
-- `updated_at` on any table). A before update trigger stamps it, so every writer is covered: the app,
-- the assistant and a restore all move it, and a client cannot choose it.
--
-- It is plain metadata, not a health value. The migration inserts no row and no policy, and the default
-- on the added column fills every existing row with the migration's own time, so it applies to a
-- database that holds any data. Existing rows read as changed at that moment, which is true enough:
-- no assistant action refers to them.

alter table public.food_log_entries add column updated_at timestamptz not null default now();

comment on column public.food_log_entries.updated_at is
  'When the entry last changed, stamped by a trigger on every update (insert uses the default). It has no client grant. The assistant compares it with the instant it recorded to tell whether Undo is still safe.';

-- Stamps the row with the transaction's time, whatever the statement sent for the column. One update
-- statement over several rows therefore gives them all the same instant, which is what a multi-row
-- assistant action records. Security invoker, since it only assigns to the row it is given. The empty
-- search_path forces every reference to be schema-qualified.
create function public.food_log_entries_stamp_updated_at()
returns trigger
language plpgsql
volatile
security invoker
set search_path = ''
as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

-- Only the trigger runs this function, and firing a trigger needs no execute privilege, so nobody holds
-- it. `create function` grants execute to public and the Supabase default ACL grants it to the API
-- roles, so each is revoked by name.
revoke execute on function public.food_log_entries_stamp_updated_at() from public, anon, authenticated, service_role;

create trigger food_log_entries_stamp_updated_at
  before update on public.food_log_entries
  for each row
  execute function public.food_log_entries_stamp_updated_at();
