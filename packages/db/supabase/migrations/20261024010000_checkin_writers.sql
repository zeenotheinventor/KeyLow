-- checkin_writers: `record_checkin` and `record_targets`, the only writers of `expenditure_snapshots`
-- and `targets`, and the service role's reads for `run-checkin` (KEY-611).
-- Everything here is set out in docs/adr/0003-data-model.md, Amendment 13, which wins over any other
-- description. The check on `profiles.checkin_weekday` is KEY-610's and is not repeated.
--
-- These write health data. Nothing here logs a row value or raises a notice with one. A raise names
-- the rule and carries an SQLSTATE of its own, never a value. PostgreSQL's own errors are another
-- matter and no function can prevent them. A check constraint failure puts the failing row, which
-- holds health values, in the DETAIL that reaches the caller, and a failed cast quotes the text it
-- could not read in its message. So `run-checkin` must forward only `error.code` to its client and its
-- logs, never the message, the details or the hint (Amendment 9, "Health data").
--
-- The raises, with their SQLSTATEs (class KL is this schema's own):
--   no_profile      KL001  the user has no profile row to lock
--   not_owner       KL002  a program or snapshot the jsonb names is not the user's (a null program
--                          counts, because nothing is then proved to be the user's)
--   start_conflict  KL003  a start snapshot was sent for a date that already holds a check-in

-- The service role's reads, which `run-checkin` needs (Amendment 13, "Privileges and row level
-- security"). `day_totals` is a security_invoker view, so the role needs `select` on its source tables
-- as well as on the view, and `food_log_entries` and `day_logs` are on the list for that reason. A
-- grant the role already has stays as it is, and no other privilege is added to any table.
grant select on public.profiles to service_role;
grant select on public.programs to service_role;
grant select on public.weigh_ins to service_role;
grant select on public.food_log_entries to service_role;
grant select on public.day_logs to service_role;
grant select on public.day_totals to service_role;

-- Writes the check-in of the user for one date, in one transaction. It answers `recorded`, or
-- `duplicate` when the snapshot for the date exists, or `program_ended` when the program the snapshot
-- names has ended. In the last two cases it writes nothing.
--
-- A check-in that races the user saving their own targets would otherwise put engine targets back over
-- the manual ones, because saving them ends the program (ADR 0002, Amendment 2, Q5). The ownership
-- check comes first, so another user's ended program is still `not_owner`.
--
-- A null `p_next_checkin_date` leaves `programs.next_checkin_date` alone, as it does in `record_targets`.
--
-- `p_snapshot` names the snapshot's columns, and the snapshot is always a `checkin` row. `p_targets`
-- names the new target's columns. Every column is built from a named key. `user_id`, `id`,
-- `created_at` and `effective_to` are never read from either jsonb, `kind` is fixed, and the new
-- target's program and snapshot are the snapshot's program and the snapshot just written. The program
-- the snapshot names must be the user's, or the function raises `not_owner`. No jsonb is validated
-- here: the tables' own checks do that when the row is inserted, and a failed check rolls the whole
-- call back, so no snapshot is left behind.
--
-- `nullif(..., 'null')` turns a JSON null into a SQL null. `->` gives a JSON null for a key that is
-- present and null, and that is not a SQL null, so without it a null `measurement` would pass the
-- `(kind = 'start') = (measurement is null)` check as if it were a measurement, and a null `basis` or
-- `params` would pass its not null column.
--
-- The first statement locks the user's profile row, which serialises both writers per user (the row
-- lock of Amendment 7, "Concurrency"). Without it two callers could each close the current target and
-- each insert a new one, and the second would fail on the one-current index instead of answering
-- `duplicate`. Every object is schema-qualified, because the search path is empty.
create function public.record_checkin(
  p_user_id uuid,
  p_snapshot jsonb,
  p_targets jsonb,
  p_next_checkin_date date
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_program_id uuid := (p_snapshot ->> 'program_id')::uuid;
  v_snapshot_id uuid;
  v_as_of_date date;
  v_current_effective_from date;
  v_effective_from date;
begin
  perform 1 from public.profiles where id = p_user_id for update;
  if not found then
    raise exception 'no_profile' using errcode = 'KL001';
  end if;

  if v_program_id is null
    or not exists (select 1 from public.programs where id = v_program_id and user_id = p_user_id)
  then
    raise exception 'not_owner' using errcode = 'KL002';
  end if;

  if exists (select 1 from public.programs where id = v_program_id and ended_on is not null) then
    return 'program_ended';
  end if;

  insert into public.expenditure_snapshots (
    user_id, program_id, as_of_date, kind, mu_kcal, var_kcal2, measurement, trend_weight_kg,
    engine_version, params
  )
  values (
    p_user_id,
    v_program_id,
    (p_snapshot ->> 'as_of_date')::date,
    'checkin',
    (p_snapshot ->> 'mu_kcal')::numeric,
    (p_snapshot ->> 'var_kcal2')::numeric,
    nullif(p_snapshot -> 'measurement', 'null'::jsonb),
    (p_snapshot ->> 'trend_weight_kg')::numeric,
    p_snapshot ->> 'engine_version',
    nullif(p_snapshot -> 'params', 'null'::jsonb)
  )
  on conflict (user_id, as_of_date) do nothing
  returning id, as_of_date into v_snapshot_id, v_as_of_date;

  if v_snapshot_id is null then
    return 'duplicate';
  end if;

  -- The new row takes effect on the later of the check-in date and the current row's start, and the
  -- current row closes at that same date, so intervals never overlap and the latest write wins. With
  -- no current row, `greatest` ignores the null and the new row takes the check-in date.
  select effective_from into v_current_effective_from
    from public.targets where user_id = p_user_id and effective_to is null;
  v_effective_from := greatest(v_as_of_date, v_current_effective_from);

  update public.targets set effective_to = v_effective_from
    where user_id = p_user_id and effective_to is null;

  insert into public.targets (
    user_id, program_id, expenditure_snapshot_id, effective_from, calories_kcal, protein_g, fat_g,
    carbs_g, dow_calories_kcal, basis, engine_version, params
  )
  values (
    p_user_id,
    v_program_id,
    v_snapshot_id,
    v_effective_from,
    (p_targets ->> 'calories_kcal')::integer,
    (p_targets ->> 'protein_g')::numeric,
    (p_targets ->> 'fat_g')::numeric,
    (p_targets ->> 'carbs_g')::numeric,
    case when pg_catalog.jsonb_typeof(p_targets -> 'dow_calories_kcal') = 'array' then
      array(
        select day_calories::integer
        from pg_catalog.jsonb_array_elements_text(p_targets -> 'dow_calories_kcal') with ordinality as element(day_calories, day_number)
        order by day_number
      )
    end,
    nullif(p_targets -> 'basis', 'null'::jsonb),
    p_targets ->> 'engine_version',
    nullif(p_targets -> 'params', 'null'::jsonb)
  );

  if p_next_checkin_date is not null then
    update public.programs set next_checkin_date = p_next_checkin_date
      where id = v_program_id and user_id = p_user_id;
  end if;

  return 'recorded';
end;
$$;

-- Writes new targets for the user, and optionally the start snapshot, the schedule and the check-in
-- weekday, in one transaction. Answers the new target's id.
--
-- With a `p_start_snapshot` (a JSON null counts as none), the snapshot for `(user_id, as_of_date)` is
-- written, or replaced in place when it is a `start` row (the `id` and `created_at` stay, so earlier
-- targets still point at it), and the new target points at it. When that date holds a `checkin` row the
-- function raises `start_conflict`. Without one, `p_targets` names the snapshot the new target points
-- at, which must be the user's. The program the targets name, and the start snapshot's, must be the
-- user's, or the function raises `not_owner`. This writer checks ownership only: it still writes for an
-- ended program. The new target takes `effective_from` from `p_targets` and, as in `record_checkin`,
-- the later of that date and the current row's start.
--
-- A null `p_next_checkin_date` leaves `programs.next_checkin_date` alone and a null `p_checkin_weekday`
-- leaves `profiles.checkin_weekday` alone. The weekday is checked by `profiles_checkin_weekday_check`.
create function public.record_targets(
  p_user_id uuid,
  p_targets jsonb,
  p_start_snapshot jsonb,
  p_next_checkin_date date,
  p_checkin_weekday integer
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_program_id uuid := (p_targets ->> 'program_id')::uuid;
  v_start_snapshot jsonb := nullif(p_start_snapshot, 'null'::jsonb);
  v_start_program_id uuid := (v_start_snapshot ->> 'program_id')::uuid;
  v_snapshot_id uuid;
  v_requested_effective_from date := (p_targets ->> 'effective_from')::date;
  v_current_effective_from date;
  v_effective_from date;
  v_targets_id uuid;
begin
  perform 1 from public.profiles where id = p_user_id for update;
  if not found then
    raise exception 'no_profile' using errcode = 'KL001';
  end if;

  if v_program_id is null
    or not exists (select 1 from public.programs where id = v_program_id and user_id = p_user_id)
  then
    raise exception 'not_owner' using errcode = 'KL002';
  end if;

  if v_start_snapshot is not null then
    if v_start_program_id is null
      or not exists (select 1 from public.programs where id = v_start_program_id and user_id = p_user_id)
    then
      raise exception 'not_owner' using errcode = 'KL002';
    end if;

    -- A `start` row on the date is replaced in place. The update applies only to a `start` row, so
    -- when the date holds a `checkin` row nothing is returned.
    insert into public.expenditure_snapshots as snapshot (
      user_id, program_id, as_of_date, kind, mu_kcal, var_kcal2, measurement, trend_weight_kg,
      engine_version, params
    )
    values (
      p_user_id,
      v_start_program_id,
      (v_start_snapshot ->> 'as_of_date')::date,
      'start',
      (v_start_snapshot ->> 'mu_kcal')::numeric,
      (v_start_snapshot ->> 'var_kcal2')::numeric,
      nullif(v_start_snapshot -> 'measurement', 'null'::jsonb),
      (v_start_snapshot ->> 'trend_weight_kg')::numeric,
      v_start_snapshot ->> 'engine_version',
      nullif(v_start_snapshot -> 'params', 'null'::jsonb)
    )
    on conflict (user_id, as_of_date) do update set
      program_id = excluded.program_id,
      mu_kcal = excluded.mu_kcal,
      var_kcal2 = excluded.var_kcal2,
      measurement = excluded.measurement,
      trend_weight_kg = excluded.trend_weight_kg,
      engine_version = excluded.engine_version,
      params = excluded.params
      where snapshot.kind = 'start'
    returning snapshot.id into v_snapshot_id;

    if v_snapshot_id is null then
      raise exception 'start_conflict' using errcode = 'KL003';
    end if;
  else
    v_snapshot_id := (p_targets ->> 'expenditure_snapshot_id')::uuid;

    if v_snapshot_id is not null
      and not exists (
        select 1 from public.expenditure_snapshots where id = v_snapshot_id and user_id = p_user_id
      )
    then
      raise exception 'not_owner' using errcode = 'KL002';
    end if;
  end if;

  select effective_from into v_current_effective_from
    from public.targets where user_id = p_user_id and effective_to is null;
  -- A missing date stays missing, so the not null column refuses it, instead of quietly taking the
  -- current row's start.
  v_effective_from := case
    when v_requested_effective_from is null then null
    else greatest(v_requested_effective_from, v_current_effective_from)
  end;

  update public.targets set effective_to = v_effective_from
    where user_id = p_user_id and effective_to is null;

  insert into public.targets (
    user_id, program_id, expenditure_snapshot_id, effective_from, calories_kcal, protein_g, fat_g,
    carbs_g, dow_calories_kcal, basis, engine_version, params
  )
  values (
    p_user_id,
    v_program_id,
    v_snapshot_id,
    v_effective_from,
    (p_targets ->> 'calories_kcal')::integer,
    (p_targets ->> 'protein_g')::numeric,
    (p_targets ->> 'fat_g')::numeric,
    (p_targets ->> 'carbs_g')::numeric,
    case when pg_catalog.jsonb_typeof(p_targets -> 'dow_calories_kcal') = 'array' then
      array(
        select day_calories::integer
        from pg_catalog.jsonb_array_elements_text(p_targets -> 'dow_calories_kcal') with ordinality as element(day_calories, day_number)
        order by day_number
      )
    end,
    nullif(p_targets -> 'basis', 'null'::jsonb),
    p_targets ->> 'engine_version',
    nullif(p_targets -> 'params', 'null'::jsonb)
  )
  returning id into v_targets_id;

  if p_next_checkin_date is not null then
    update public.programs set next_checkin_date = p_next_checkin_date
      where id = v_program_id and user_id = p_user_id;
  end if;

  if p_checkin_weekday is not null then
    update public.profiles set checkin_weekday = p_checkin_weekday where id = p_user_id;
  end if;

  return v_targets_id;
end;
$$;

-- Only the service role may execute the writers. Revoking from `public` alone would leave the explicit
-- grants that Supabase's default privileges give `anon` and `authenticated`.
revoke execute on function public.record_checkin(uuid, jsonb, jsonb, date)
  from public, anon, authenticated;
grant execute on function public.record_checkin(uuid, jsonb, jsonb, date) to service_role;

revoke execute on function public.record_targets(uuid, jsonb, jsonb, date, integer)
  from public, anon, authenticated;
grant execute on function public.record_targets(uuid, jsonb, jsonb, date, integer) to service_role;
