-- rate_limits: one counter row per (bucket, window), and the function the
-- Open Food Facts proxy Edge Functions call to spend one hit from a bucket.
-- Shape and rules come from docs/adr/0003-data-model.md, Amendment 1.

-- A fixed window counter. Rows are written only by consume_rate_limit(), and
-- the function deletes a bucket's expired windows on every call, so the table
-- holds roughly one row per active bucket.
create table public.rate_limits (
  bucket text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (bucket, window_start)
);

alter table public.rate_limits enable row level security;

-- No policies, and no privileges for any API role, service_role included.
-- consume_rate_limit() is security definer, so the service role needs no DML
-- on the table, and the CLI default ACL would otherwise leave it TRUNCATE,
-- REFERENCES and TRIGGER.
revoke all on public.rate_limits from anon, authenticated, service_role;

-- Spends one hit from p_bucket and says whether the caller is still within
-- p_max hits per window of p_window_seconds. The windows are fixed, aligned
-- to the epoch, so every caller agrees where a window starts and ends. The
-- hit is counted even when it is refused, which keeps a caller that keeps
-- retrying refused until the window ends.
--
-- retry_after_seconds is the whole seconds left in the current window,
-- rounded up, so it is between 1 and p_window_seconds whether the call was
-- allowed or refused.
--
-- The window is read from the wall clock rather than the transaction start,
-- so a caller that holds one transaction open still sees windows roll over.
-- now() and clock_timestamp() differ by the age of the transaction, which is
-- milliseconds in an Edge Function call.
--
-- Security definer, because the table is closed to every API role. The empty
-- search_path forces every object reference below to be schema-qualified.
-- Only the service role may execute it: a caller who could would be able to
-- burn the global bucket and lock every user out of Open Food Facts.
--
-- A p_max or p_window_seconds that is null or below 1 raises
-- invalid_parameter_value (SQLSTATE 22023). Neither could describe a real
-- limit. A null p_bucket fails the not-null constraint on the table (23502).
create function public.consume_rate_limit(p_bucket text, p_max integer, p_window_seconds integer)
returns table (allowed boolean, retry_after_seconds integer)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_window interval;
  v_window_start timestamptz;
  v_hits integer;
  v_seconds_left integer;
begin
  if coalesce(p_max, 0) < 1 then
    raise exception 'p_max must be at least 1' using errcode = '22023';
  end if;
  if coalesce(p_window_seconds, 0) < 1 then
    raise exception 'p_window_seconds must be at least 1' using errcode = '22023';
  end if;

  v_window := pg_catalog.make_interval(secs => p_window_seconds);
  v_window_start := pg_catalog.date_bin(v_window, v_now, 'epoch'::timestamptz);

  -- Prune before counting, so two callers on either side of a window boundary
  -- take their row locks in the same order and cannot deadlock.
  delete from public.rate_limits
  where bucket = p_bucket and window_start < v_window_start;

  insert into public.rate_limits as rate_limit (bucket, window_start, hits)
  values (p_bucket, v_window_start, 1)
  on conflict (bucket, window_start) do update set hits = rate_limit.hits + 1
  returning rate_limit.hits into v_hits;

  v_seconds_left := pg_catalog.ceil(
    extract(epoch from (v_window_start + v_window - v_now))
  )::integer;

  return query select
    v_hits <= p_max,
    greatest(1, least(p_window_seconds, v_seconds_left));
end;
$$;

revoke execute on function public.consume_rate_limit(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, integer, integer) to service_role;
