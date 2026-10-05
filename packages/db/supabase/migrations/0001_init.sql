-- 0001_init: the profiles table and the signup trigger that creates its rows.
-- Column list frozen in docs/adr/0003-data-model.md. No other tables in M1.

create extension if not exists pg_trgm with schema extensions;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  sex text,
  birth_date date,
  height_cm numeric,
  activity text,
  weight_unit text,
  energy_unit text,
  timezone text not null default 'UTC',
  checkin_weekday int,
  onboarding_weight_kg numeric,
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Set the table privileges explicitly so nothing relies on the default ones.
-- The CLI and hosted defaults differ and are changing (auto_expose_new_tables
-- is removed on 2026-10-30). Start from a clean slate, then give the signed-in
-- role only the four statements the policies below narrow to the owner's row.
-- The anon role keeps nothing.
revoke all on public.profiles from anon, authenticated;
grant select, insert, update, delete on public.profiles to authenticated;

-- Owner-only access. `(select auth.uid())` is evaluated once per statement
-- instead of once per row.
create policy "profiles_select_own" on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id);

create policy "profiles_insert_own" on public.profiles
  for insert to authenticated
  with check ((select auth.uid()) = id);

create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "profiles_delete_own" on public.profiles
  for delete to authenticated
  using ((select auth.uid()) = id);

-- Creates the profiles row for every new auth user, whichever provider they
-- signed up with. Security definer so the insert succeeds regardless of the
-- role that triggered the signup. The empty search_path forces every object
-- reference below to be schema-qualified.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

-- Only the trigger needs to run this function, so it is not exposed as an RPC.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
