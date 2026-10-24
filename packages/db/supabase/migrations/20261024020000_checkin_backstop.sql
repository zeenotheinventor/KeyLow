-- checkin_backstop: the hourly job that calls `run-checkin` in backstop mode, so a check-in happens in
-- the first hour of each user's local day whether or not the app was opened (KEY-616).
-- Everything here is set out in docs/adr/0003-data-model.md, Amendment 13, "The backstop", which wins
-- over any other description.
--
-- The project URL and the shared secret are two Vault secrets, `keylow_project_url` and
-- `checkin_cron_secret`. They are created by hand in the hosted dashboard (KEY-615) and never in a
-- migration, because the repository is public. A local stack and CI have neither, so the function
-- does nothing there.

-- pg_cron keeps its functions in `pg_catalog` and its tables in its own `cron` schema. pg_net's
-- functions are in the `net` schema. Both statements are no-ops once the hosted project has the
-- extensions enabled.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- Posts `{"mode":"backstop"}` to the project's `run-checkin` function with the shared secret in the
-- `x-checkin-secret` header. It answers `posted`, or `skipped` when either secret is missing, in which
-- case it posts nothing. There is no Authorization header, because `run-checkin` has `verify_jwt` off
-- and checks the secret itself. The base URL is stored with no trailing slash. The request goes on
-- pg_net's queue and a background worker sends it, so `posted` and a succeeded row in
-- `cron.job_run_details` only prove the request was queued, and the response status is in
-- `net._http_response`.
--
-- It never raises with, or returns, a secret value. It is security definer so the job can read the
-- Vault, which no API role can, and the empty search_path makes every object schema-qualified.
create function public.invoke_checkin_backstop()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  project_url text;
  cron_secret text;
begin
  select decrypted_secret into project_url
  from vault.decrypted_secrets
  where name = 'keylow_project_url';

  select decrypted_secret into cron_secret
  from vault.decrypted_secrets
  where name = 'checkin_cron_secret';

  if coalesce(project_url, '') = '' or coalesce(cron_secret, '') = '' then
    return 'skipped';
  end if;

  perform net.http_post(
    url := project_url || '/functions/v1/run-checkin',
    headers := jsonb_build_object('content-type', 'application/json', 'x-checkin-secret', cron_secret),
    body := '{"mode":"backstop"}'::jsonb,
    timeout_milliseconds := 30000
  );

  return 'posted';
end;
$$;

-- Only the job runs it, as postgres, the owner. New functions in `public` are granted to the API roles
-- by default, so each of them is named here as well as public.
revoke execute on function public.invoke_checkin_backstop() from public, anon, authenticated, service_role;

-- Minute 17 of every hour (ADR 0002, Amendment 2, Q7). A job of the same name is removed first, so
-- running this again replaces the job and never adds a second one.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'run-checkin-backstop') then
    perform cron.unschedule('run-checkin-backstop');
  end if;

  perform cron.schedule('run-checkin-backstop', '17 * * * *', 'select public.invoke_checkin_backstop()');
end;
$$;
