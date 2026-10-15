-- profile_terms_acceptance: records, on the profile, that the user accepted the
-- Terms and the Privacy Policy. This is the explicit consent for health data
-- (KEY-136). Column list and grants are set out in docs/adr/0003-data-model.md,
-- Amendment 3.

-- A null pair means "never accepted". Both are set together, always by the
-- database: the sign-up trigger below and public.accept_terms() are the only
-- writers, and each takes the time from now(), never from a client.
alter table public.profiles
  add column terms_accepted_at timestamptz,
  add column terms_version text;

alter table public.profiles
  add constraint profiles_terms_acceptance_paired
  check ((terms_accepted_at is null) = (terms_version is null));

-- Sign-up trigger: everything it did before, plus the acceptance. The client
-- passes the version of the terms it showed as user metadata
-- (`options.data.terms_version`) in the same call that creates the account.
-- A missing, null or blank value records no acceptance. The timestamp is the
-- database clock, so a client-sent `terms_accepted_at` in the metadata is
-- ignored. Same hardening as before: security definer, empty search_path.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  accepted_version text := new.raw_user_meta_data ->> 'terms_version';
begin
  if pg_catalog.btrim(accepted_version) = '' then
    accepted_version := null;
  end if;

  insert into public.profiles (id, terms_version, terms_accepted_at)
  values (
    new.id,
    accepted_version,
    case when accepted_version is not null then pg_catalog.now() end
  );
  return new;
end;
$$;

-- Only the trigger needs to run this function, so it is not exposed as an RPC.
-- `create or replace` keeps the existing grants. This states them again so the
-- migration does not depend on that.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Records acceptance for the signed-in user: the Google path (accept straight
-- after sign-in) and the accept-to-continue gate for a newer version. Accepting
-- a newer version overwrites both columns. Security definer because the
-- terms columns are not writable through the table grants below. Authenticated
-- only: service_role has no caller, so it could only ever hit the error.
create function public.accept_terms(p_version text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
begin
  if caller is null then
    raise exception 'accept_terms needs a signed-in user'
      using errcode = '28000';
  end if;

  if p_version is null or pg_catalog.btrim(p_version) = '' then
    raise exception 'accept_terms needs a non-empty version'
      using errcode = '22023';
  end if;

  update public.profiles
  set terms_version = p_version,
      terms_accepted_at = pg_catalog.now()
  where id = caller;

  -- A signed-in user without a profile row would otherwise get a silent no-op
  -- and believe they had accepted.
  if not found then
    raise exception 'accept_terms found no profile for the signed-in user'
      using errcode = 'P0002';
  end if;
end;
$$;

revoke execute on function public.accept_terms(text) from public, anon;
grant execute on function public.accept_terms(text) to authenticated;

-- Narrow the table grants so a client cannot write the terms columns directly.
-- 0001_init granted insert and update on every column. Both are now explicit
-- column lists:
--   * the terms columns are left out of both, so the RPC and the trigger are
--     the only ways to write them.
--   * `created_at` is left out of both. It is an audit column the database
--     fills in.
--   * `id` stays in insert only. A client never changes a row's id, and
--     nothing in the apps inserts profiles (the trigger does), but the insert
--     grant is narrowed rather than removed so the owner-only insert policy
--     keeps meaning something.
-- A column added to profiles later is not writable by clients until a
-- migration grants it. Select and delete are unchanged.
revoke insert, update on public.profiles from authenticated;

grant insert (
  id, sex, birth_date, height_cm, activity, weight_unit, energy_unit, timezone,
  checkin_weekday, onboarding_weight_kg, onboarding_completed_at
) on public.profiles to authenticated;

grant update (
  sex, birth_date, height_cm, activity, weight_unit, energy_unit, timezone,
  checkin_weekday, onboarding_weight_kg, onboarding_completed_at
) on public.profiles to authenticated;
