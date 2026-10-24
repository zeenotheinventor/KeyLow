-- Asserts the check-in backstop: the pg_cron and pg_net extensions, `public.invoke_checkin_backstop()`
-- and the `run-checkin-backstop` job (ADR 0003, Amendment 13, "The backstop").
--
-- `supabase test db` runs this file as postgres inside a transaction that is rolled back, so the
-- secrets and the queued requests made here never persist, and pg_net sends nothing because its queue
-- rows are never committed.
--
-- The two Vault secrets are fixtures with made-up values. No assertion name quotes a secret and none
-- compares one by printing it: the header check is a boolean, so a failure shows no value.

begin;

select plan(38);

-- The queue rows and secrets this file adds are counted against what was there before, so the file
-- does not depend on an empty queue. The two secrets are removed first, so the "no secrets" cases hold
-- on a stack where somebody has already created them. The delete is rolled back with everything else.
delete from vault.secrets where name in ('keylow_project_url', 'checkin_cron_secret');

create temporary table queue_before as
select count(*) as total from net.http_request_queue;

-- The extensions.
select has_extension('pg_cron', 'pg_cron is installed');
select has_extension('pg_net', 'pg_net is installed');

-- The function.
select has_function('public', 'invoke_checkin_backstop', array[]::text[], 'invoke_checkin_backstop() exists');
select function_returns('public', 'invoke_checkin_backstop', array[]::text[], 'text', 'invoke_checkin_backstop() returns text');
select is_definer('public', 'invoke_checkin_backstop', array[]::text[], 'invoke_checkin_backstop() is security definer');
select ok(
  (select proconfig @> array['search_path=""'] from pg_proc where oid = to_regprocedure('public.invoke_checkin_backstop()')),
  'invoke_checkin_backstop() sets an empty search_path'
);

-- Execute is revoked from everyone: no role holds it through public or by name.
select ok(
  not exists (
    select 1
    from pg_proc, aclexplode(proacl) as granted
    where oid = to_regprocedure('public.invoke_checkin_backstop()')
      and granted.grantee = 0
  ),
  'execute is not granted to public'
);
select ok(not has_function_privilege('anon', 'public.invoke_checkin_backstop()', 'execute'), 'anon cannot execute it');
select ok(not has_function_privilege('authenticated', 'public.invoke_checkin_backstop()', 'execute'), 'authenticated cannot execute it');
select ok(not has_function_privilege('service_role', 'public.invoke_checkin_backstop()', 'execute'), 'service_role cannot execute it');

set local role anon;
select throws_ok('select public.invoke_checkin_backstop()', '42501', null, 'anon calling it is refused');
reset role;
set local role authenticated;
select throws_ok('select public.invoke_checkin_backstop()', '42501', null, 'authenticated calling it is refused');
reset role;
set local role service_role;
select throws_ok('select public.invoke_checkin_backstop()', '42501', null, 'service_role calling it is refused');
reset role;

-- The job.
select is(
  (select count(*)::int from cron.job where jobname = 'run-checkin-backstop'),
  1,
  'there is exactly one run-checkin-backstop job'
);
select is(
  (select count(*)::int from cron.job where jobname = 'run-checkin-backstop' and active),
  1,
  'the run-checkin-backstop job is active'
);
select is(
  (select schedule from cron.job where jobname = 'run-checkin-backstop'),
  '17 * * * *',
  'the job runs at minute 17 of every hour'
);
select is(
  (select command from cron.job where jobname = 'run-checkin-backstop'),
  'select public.invoke_checkin_backstop()',
  'the job calls invoke_checkin_backstop()'
);

-- Running the migration's schedule block twice more leaves one job, so a rerun replaces the job.
do $$
begin
  for run_number in 1..2 loop
    if exists (select 1 from cron.job where jobname = 'run-checkin-backstop') then
      perform cron.unschedule('run-checkin-backstop');
    end if;

    perform cron.schedule('run-checkin-backstop', '17 * * * *', 'select public.invoke_checkin_backstop()');
  end loop;
end;
$$;
select is(
  (select count(*)::int from cron.job where jobname = 'run-checkin-backstop'),
  1,
  'running the schedule block again still leaves exactly one job'
);

-- With neither secret, it answers skipped and queues nothing.
select is(public.invoke_checkin_backstop(), 'skipped', 'it answers skipped when both secrets are missing');
select is(
  (select count(*)::int from net.http_request_queue) - (select total::int from queue_before),
  0,
  'it queues no request when both secrets are missing'
);

-- With only one of the two, it still answers skipped and queues nothing.
select vault.create_secret('https://project.example.test', 'keylow_project_url');
select is(public.invoke_checkin_backstop(), 'skipped', 'it answers skipped when only the project url exists');
select is(
  (select count(*)::int from net.http_request_queue) - (select total::int from queue_before),
  0,
  'it queues no request when only the project url exists'
);
delete from vault.secrets where name = 'keylow_project_url';

select vault.create_secret('fixture-check-in-secret', 'checkin_cron_secret');
select is(public.invoke_checkin_backstop(), 'skipped', 'it answers skipped when only the check-in secret exists');
select is(
  (select count(*)::int from net.http_request_queue) - (select total::int from queue_before),
  0,
  'it queues no request when only the check-in secret exists'
);

-- A secret whose value is an empty string counts as missing.
select vault.create_secret('', 'keylow_project_url');
select is(public.invoke_checkin_backstop(), 'skipped', 'it answers skipped when the project url is an empty string');
select is(
  (select count(*)::int from net.http_request_queue) - (select total::int from queue_before),
  0,
  'it queues no request when the project url is an empty string'
);
delete from vault.secrets where name = 'keylow_project_url';

select vault.create_secret('https://project.example.test', 'keylow_project_url');
delete from vault.secrets where name = 'checkin_cron_secret';
select vault.create_secret('', 'checkin_cron_secret');
select is(public.invoke_checkin_backstop(), 'skipped', 'it answers skipped when the check-in secret is an empty string');
select is(
  (select count(*)::int from net.http_request_queue) - (select total::int from queue_before),
  0,
  'it queues no request when the check-in secret is an empty string'
);
delete from vault.secrets where name in ('keylow_project_url', 'checkin_cron_secret');
select vault.create_secret('fixture-check-in-secret', 'checkin_cron_secret');

-- With both, it posts once.
select vault.create_secret('https://project.example.test', 'keylow_project_url');
select is(public.invoke_checkin_backstop(), 'posted', 'it answers posted when both secrets exist');

select is(
  (select count(*)::int from net.http_request_queue) - (select total::int from queue_before),
  1,
  'it queues exactly one request'
);

create temporary table queued_request as
select method::text as method, url, headers, convert_from(body, 'utf8')::jsonb as body, timeout_milliseconds
from net.http_request_queue
order by id desc
limit 1;

select is(
  (select url from queued_request),
  'https://project.example.test/functions/v1/run-checkin',
  'the request goes to the project url plus /functions/v1/run-checkin'
);
select is((select method from queued_request), 'POST', 'the request is a POST');
select ok((select headers ? 'x-checkin-secret' from queued_request), 'the request carries an x-checkin-secret header');
select ok(
  (select headers ->> 'x-checkin-secret' = (select decrypted_secret from vault.decrypted_secrets where name = 'checkin_cron_secret')
   from queued_request),
  'the x-checkin-secret header holds the checkin_cron_secret'
);
select is((select headers ->> 'content-type' from queued_request), 'application/json', 'the request is sent as JSON');
select ok(
  (select not exists (select 1 from jsonb_object_keys(headers) as header_name where lower(header_name) = 'authorization')
   from queued_request),
  'the request carries no Authorization header'
);
select is((select body from queued_request), '{"mode": "backstop"}'::jsonb, 'the request body is {"mode":"backstop"}');
select is((select timeout_milliseconds from queued_request), 30000, 'the request times out after 30000 milliseconds');

select * from finish();

rollback;
