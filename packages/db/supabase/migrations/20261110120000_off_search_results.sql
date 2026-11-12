-- off_search_results: the shared store of Open Food Facts search answers, and the function the
-- off-search Edge Function calls to keep it. Shape and rules come from docs/adr/0003-data-model.md,
-- Amendment 16.

-- One row per cleaned search text, replaced whole by each successful search for it. The row has a
-- natural key, so it has neither id nor created_at (Amendment 16 is the fourth exception to
-- Amendment 1). It holds no user id and no later column may: it records only that someone searched
-- these words, and the answer is shared across people on purpose.
create table public.off_search_results (
  query_key text primary key check (char_length(query_key) between 2 and 100),
  candidates jsonb not null check (jsonb_typeof(candidates) = 'array'),
  fetched_at timestamptz not null default now()
);

-- Serves the horizon delete in store_off_search_results.
create index off_search_results_fetched_at_idx on public.off_search_results (fetched_at);

alter table public.off_search_results enable row level security;

-- No policies, and no privilege for anon or authenticated. The service role may read a row and
-- nothing else, so every write goes through store_off_search_results().
revoke all on public.off_search_results from anon, authenticated, service_role;
grant select on public.off_search_results to service_role;

-- Stores the normalised candidates for p_query_key, and moves fetched_at to now. In the same call it
-- deletes at most 100 rows older than p_keep_seconds, oldest first, so the table stays bounded
-- without a scheduled job (there is no pg_cron here, and consume_rate_limit cleans up the same way).
--
-- Security definer, because the service role has no write privilege on the table. The empty
-- search_path forces every object reference below to be schema-qualified. Only the service role may
-- execute it: a caller who could would be able to fill the store with chosen answers.
--
-- A p_candidates that is not a JSON array, or a p_keep_seconds that is null or below 1, raises
-- invalid_parameter_value (SQLSTATE 22023), and the messages quote no value. A null or out of range
-- p_query_key fails the table's own checks.
create function public.store_off_search_results(
  p_query_key text,
  p_candidates jsonb,
  p_keep_seconds integer
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if p_candidates is null or pg_catalog.jsonb_typeof(p_candidates) <> 'array' then
    raise exception 'p_candidates must be a JSON array' using errcode = '22023';
  end if;
  if coalesce(p_keep_seconds, 0) < 1 then
    raise exception 'p_keep_seconds must be at least 1' using errcode = '22023';
  end if;

  insert into public.off_search_results (query_key, candidates, fetched_at)
  values (p_query_key, p_candidates, pg_catalog.now())
  on conflict (query_key) do update
    set candidates = excluded.candidates, fetched_at = excluded.fetched_at;

  delete from public.off_search_results
  where query_key in (
    select expired.query_key
    from public.off_search_results as expired
    where expired.fetched_at < pg_catalog.now() - pg_catalog.make_interval(secs => p_keep_seconds)
    order by expired.fetched_at
    limit 100
    for update skip locked
  );
end;
$$;

revoke execute on function public.store_off_search_results(text, jsonb, integer)
  from public, anon, authenticated;
grant execute on function public.store_off_search_results(text, jsonb, integer) to service_role;
