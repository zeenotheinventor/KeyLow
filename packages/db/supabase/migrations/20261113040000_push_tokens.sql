-- push_tokens: the Expo push token of each signed-in phone (KEY-1066, part of KEY-1063). Everything
-- here is set out in docs/adr/0003-data-model.md, Amendment 25, which wins over any other description.
-- The assistant function reads a person's tokens with the service client to send a reply notification.
-- The phone writes its own token through `register_push_token` and `unregister_push_token`.
--
-- A push token is personal data, not health data, and it is a device credential, so the whole-account
-- export leaves it out. Nothing here logs a token. The migration inserts no row, so it applies to a
-- database that holds any data.

-- `token` is unique across all people: one phone holds one token, and when a phone changes hands the
-- new owner's registration moves the row (see `register_push_token`). `user_id` defaults to the caller.
create table public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  token text not null,
  platform text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint push_tokens_token_key unique (token),
  constraint push_tokens_token_check check (token like 'ExponentPushToken[_%]' and char_length(token) <= 200),
  constraint push_tokens_platform_check check (platform in ('android', 'ios'))
);

-- Serves the cascade from `auth.users` and the read of one person's tokens.
create index push_tokens_user_id_idx on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;

-- Set the table privileges explicitly so nothing relies on the default ones (see 0001_init.sql). A person
-- manages their own rows. `user_id` is in no client grant on update, so a row cannot be handed to
-- someone else. The service role reads, to send a notification, and deletes a token Expo reports as no longer registered. The anon role keeps nothing.
revoke all on public.push_tokens from anon, authenticated, service_role;

grant select, delete on public.push_tokens to authenticated;
grant insert (token, platform) on public.push_tokens to authenticated;
grant update (token, platform) on public.push_tokens to authenticated;
grant select, delete on public.push_tokens to service_role;

create policy "push_tokens_select_own" on public.push_tokens
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "push_tokens_insert_own" on public.push_tokens
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "push_tokens_update_own" on public.push_tokens
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "push_tokens_delete_own" on public.push_tokens
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- Stamps the row with the transaction's time, whatever the statement sent for the column. The empty
-- search_path forces every reference to be schema-qualified.
create function public.push_tokens_stamp_updated_at()
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

-- Only the trigger runs this function, so nobody holds it.
revoke execute on function public.push_tokens_stamp_updated_at() from public, anon, authenticated, service_role;

create trigger push_tokens_stamp_updated_at
  before update on public.push_tokens
  for each row
  execute function public.push_tokens_stamp_updated_at();

-- Registers this phone's token for the caller. A token that another person's row holds moves to the
-- caller, because the phone changed hands or the other person signed out without unregistering, and a
-- policy cannot let one person take over another's row. Registering the same token again by the same
-- person changes nothing but `platform` and `updated_at`. Security definer so the upsert can see and
-- move a row the caller does not own, which is why it names the caller from `auth.uid()` and nothing
-- else, and refuses a call with no signed-in person. Parameters carry the `p_` prefix so they cannot
-- shadow a column.
create function public.register_push_token(p_token text, p_platform text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
begin
  if caller is null then
    raise exception 'register_push_token needs a signed-in person' using errcode = '42501';
  end if;

  insert into public.push_tokens (user_id, token, platform)
  values (caller, p_token, p_platform)
  on conflict (token) do update
    set user_id = excluded.user_id,
        platform = excluded.platform;
end;
$$;

-- Removes the caller's row for this token. Another person's row, or no row, is left alone and is not
-- an error, so signing out is idempotent. Security invoker: the delete policy already limits it to the
-- caller's own rows.
create function public.unregister_push_token(p_token text)
returns void
language sql
volatile
security invoker
set search_path = ''
as $$
  delete from public.push_tokens
  where token = p_token
    and user_id = (select auth.uid());
$$;

-- `create function` grants execute to public, and the Supabase default ACL grants it to the API roles,
-- so each is revoked before the one grant that is wanted.
revoke execute on function public.register_push_token(text, text) from public, anon, authenticated, service_role;
revoke execute on function public.unregister_push_token(text) from public, anon, authenticated, service_role;
grant execute on function public.register_push_token(text, text) to authenticated;
grant execute on function public.unregister_push_token(text) to authenticated;
