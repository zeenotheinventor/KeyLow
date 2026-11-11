-- feature_requests: what people ask the app to do, sent from the assistant or from More (KEY-976).
-- Everything here is set out in docs/adr/0003-data-model.md, Amendment 21, which wins over any other
-- description. The assistant tool and the More screen are other tickets and write through the same
-- columns.
--
-- A request can hold diary talk, so it is health data (Amendment 9, "Health data"). Nothing here logs a
-- row value or raises a notice with one. A check constraint failure can quote the failing row in
-- PostgreSQL's own error log, which no client can prevent. The migration inserts no row, so it applies
-- to a database that holds any data.

-- `user_id` defaults to the caller and a client cannot set it (see the grants below). `request` is
-- counted after a trim and in characters, as core counts it. `context` is null for a request typed in
-- More and a JSON object under 16 KB for one the assistant raised. Its shape is checked in core.
create table public.feature_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  source text not null,
  request text not null,
  context jsonb,
  created_at timestamptz not null default now(),

  constraint feature_requests_source_check check (source in ('assistant', 'more_menu')),
  constraint feature_requests_request_check check (char_length(btrim(request)) between 3 and 1000),
  constraint feature_requests_context_check check (
    case source
      when 'more_menu' then context is null
      else context is not null and jsonb_typeof(context) = 'object' and pg_column_size(context) <= 16384
    end
  )
);

-- Serves the cascade from `auth.users` and the count of the daily cap.
create index feature_requests_user_id_created_at_idx
  on public.feature_requests (user_id, created_at);

alter table public.feature_requests enable row level security;

-- Set the table privileges explicitly so nothing relies on the default ones (see 0001_init.sql). A
-- client can read its own rows and insert three columns, so it cannot set `user_id`, `id` or
-- `created_at`. Nobody can update or delete. The service role reads, so a request can be read from the
-- dashboard. The anon role keeps nothing.
revoke all on public.feature_requests from anon, authenticated, service_role;

grant select on public.feature_requests to authenticated;
grant insert (source, request, context) on public.feature_requests to authenticated;
grant select on public.feature_requests to service_role;

create policy "feature_requests_select_own" on public.feature_requests
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "feature_requests_insert_own" on public.feature_requests
  for insert to authenticated
  with check (user_id = (select auth.uid()));

-- At most 20 rows per person in any rolling 24 hours. Security invoker, so the count runs as the caller
-- under the select policy and sees only the caller's rows, which are the rows to count. The error
-- carries a fixed message and no row value, and the repo reads the message as `rate_limited`. The count
-- is its own audit, so `consume_rate_limit()` is not used.
create function public.feature_requests_enforce_daily_cap()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (
    select count(*)
    from public.feature_requests
    where user_id = new.user_id
      and created_at > now() - interval '24 hours'
  ) >= 20 then
    raise exception 'feature_requests_daily_cap' using errcode = '54000';
  end if;
  return new;
end;
$$;

-- `create function` grants execute to public, and the trigger needs no caller to hold it.
revoke execute on function public.feature_requests_enforce_daily_cap() from public, anon, authenticated, service_role;

create trigger feature_requests_daily_cap
  before insert on public.feature_requests
  for each row execute function public.feature_requests_enforce_daily_cap();
