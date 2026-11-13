-- meal_plans, meal_plan_days, meal_plan_items, the three functions that write them, and
-- profiles.meal_plan_repeat_limit (KEY-1027, part of KEY-216). Everything here is set out in
-- docs/adr/0003-data-model.md, Amendment 22, which wins over any other description.
--
-- A plan says what a person intends to eat, so it is health data. Nothing here logs a row value or
-- raises a notice with one, and the functions refuse with a message that states the rule and quotes
-- no value. A check constraint failure can quote the failing row in PostgreSQL's own error log, which
-- no client can prevent, and a cast error (22P02) can quote an input value in the server log the same
-- way, while the repo keeps the error code only. The migration inserts no row, so it applies to a database that holds any data.

-- The most appearances of one recipe in a week, chosen by the person. Null means not chosen and the
-- default of 2 applies (a rule of core, so it is not stored and changing it needs no migration). 0 means
-- no limit and 1 to 7 is the limit. Only the person writes it, so it is in the update grant and not the
-- insert grant, as Amendments 3 and 14 keep the column lists explicit.
alter table public.profiles add column meal_plan_repeat_limit smallint;

alter table public.profiles add constraint profiles_meal_plan_repeat_limit_check
  check (meal_plan_repeat_limit is null or meal_plan_repeat_limit between 0 and 7);

grant update (meal_plan_repeat_limit) on public.profiles to authenticated;

-- One row per plan. `rules` is core's (maxRepeats as it applied, leftovers, slots and the stored
-- ranking), and the database checks only that it is a JSON object. A plan is archived and never
-- deleted by a client, as a recipe is (Amendment 8).
create table public.meal_plans (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  start_date date not null,
  day_count smallint not null,
  rules jsonb not null,
  source text not null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),

  constraint meal_plans_day_count_check check (day_count between 1 and 7),
  constraint meal_plans_rules_check check (pg_catalog.jsonb_typeof(rules) = 'object'),
  constraint meal_plans_source_check check (source in ('assistant', 'app'))
);

-- Serves the person's list of plans and the cascade from `auth.users`.
create index meal_plans_owner_id_start_date_idx on public.meal_plans (owner_id, start_date);

-- One row per day of a plan. `target` is what the planner used, frozen at plan time. A confirmed day
-- holds the ids of the diary entries that confirming it wrote, and the two columns are set together.
create table public.meal_plan_days (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.meal_plans (id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  local_date date not null,
  target jsonb not null,
  confirmed_at timestamptz,
  confirmed_entry_ids uuid[],
  created_at timestamptz not null default now(),

  constraint meal_plan_days_confirmed_check check ((confirmed_at is null) = (confirmed_entry_ids is null)),
  constraint meal_plan_days_target_check check (pg_catalog.jsonb_typeof(target) = 'object')
);

-- The unique index also serves the foreign key to the plan. The owner index serves the cascade from
-- `auth.users`.
create unique index meal_plan_days_plan_id_local_date_idx on public.meal_plan_days (plan_id, local_date);
create index meal_plan_days_owner_id_idx on public.meal_plan_days (owner_id);

-- One row per planned food or recipe of a day. `nutrients` and `snapshot` are core's, frozen at plan
-- time, and the item stays meaningful through them when its food or recipe is later removed, which is
-- why the three references are set null and not cascaded. For the same reason the item check cannot
-- require the matching reference to be present.
create table public.meal_plan_items (
  id uuid primary key default gen_random_uuid(),
  day_id uuid not null references public.meal_plan_days (id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  position integer not null,
  slot_time time,
  item_type text not null,
  food_id uuid references public.foods (id) on delete set null,
  recipe_id uuid references public.recipes (id) on delete set null,
  servings numeric,
  grams numeric,
  portion_id uuid references public.food_portions (id) on delete set null,
  nutrients jsonb not null,
  leftover_of uuid,
  snapshot jsonb not null,
  created_at timestamptz not null default now(),

  -- A cooking item must be the same owner's, which the insert policy cannot say: a policy of this table
  -- that reads this table is refused as infinite recursion. The composite key says it instead, is checked
  -- without row level security, and fails the same way for an id that is missing and one that is
  -- another person's, so it leaks nothing. Only `leftover_of` is cleared when the cooking item goes.
  constraint meal_plan_items_id_owner_id_key unique (id, owner_id),
  constraint meal_plan_items_leftover_of_fkey foreign key (leftover_of, owner_id)
    references public.meal_plan_items (id, owner_id) on delete set null (leftover_of),
  constraint meal_plan_items_position_check check (position >= 0),
  constraint meal_plan_items_item_type_check check (item_type in ('food', 'recipe')),
  constraint meal_plan_items_references_check check (
    case item_type
      when 'food' then recipe_id is null
      when 'recipe' then food_id is null
    end
  ),
  constraint meal_plan_items_amount_check check (
    case item_type
      when 'recipe' then servings is not null and servings > 0
      when 'food' then grams is not null and grams > 0
    end
  ),
  constraint meal_plan_items_nutrients_check check (pg_catalog.jsonb_typeof(nutrients) = 'object'),
  constraint meal_plan_items_snapshot_check check (pg_catalog.jsonb_typeof(snapshot) = 'object')
);

-- Serves a day's items and the foreign key to the day. It is unique, so a position names one item of a
-- day and the lookup of a cooking item by day and position is never arbitrary. The plain indexes serve
-- the cascade and the foreign key checks when a food, a recipe, a portion or a cooking item is removed
-- (the reason Amendment 2 gives for the same index on log entries).
create unique index meal_plan_items_day_id_position_idx on public.meal_plan_items (day_id, position);
create index meal_plan_items_owner_id_idx on public.meal_plan_items (owner_id);
create index meal_plan_items_food_id_idx on public.meal_plan_items (food_id);
create index meal_plan_items_recipe_id_idx on public.meal_plan_items (recipe_id);
create index meal_plan_items_portion_id_idx on public.meal_plan_items (portion_id);
create index meal_plan_items_leftover_of_idx on public.meal_plan_items (leftover_of);

alter table public.meal_plans enable row level security;
alter table public.meal_plan_days enable row level security;
alter table public.meal_plan_items enable row level security;

-- Set the table privileges explicitly so nothing relies on the default ones (see 0001_init.sql). The
-- anon and service roles keep nothing, because nothing server side reads a plan: the assistant tools
-- run under the person's own JWT.
revoke all on public.meal_plans, public.meal_plan_days, public.meal_plan_items
  from anon, authenticated, service_role;

-- A plan can be read, added, and have its rules and its archive time changed. There is no delete, so
-- a client archives a plan and cannot lose one.
grant select on public.meal_plans to authenticated;
grant insert (owner_id, start_date, day_count, rules, source) on public.meal_plans to authenticated;
grant update (rules, archived_at) on public.meal_plans to authenticated;

-- A day is added with its target and afterwards changes its target and its confirmation. It has no
-- delete grant, because only its plan's removal (the cascade) takes a day away.
grant select on public.meal_plan_days to authenticated;
grant insert (plan_id, owner_id, local_date, target) on public.meal_plan_days to authenticated;
grant update (target, confirmed_at, confirmed_entry_ids) on public.meal_plan_days to authenticated;

-- An item is never updated, because replacing a day is a delete and an add.
grant select, delete on public.meal_plan_items to authenticated;
grant insert (
  day_id, owner_id, position, slot_time, item_type, food_id, recipe_id, servings, grams, portion_id,
  nutrients, leftover_of, snapshot
) on public.meal_plan_items to authenticated;

create policy "meal_plans_select_own" on public.meal_plans
  for select to authenticated
  using (owner_id = (select auth.uid()));

create policy "meal_plans_insert_own" on public.meal_plans
  for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy "meal_plans_update_own" on public.meal_plans
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "meal_plan_days_select_own" on public.meal_plan_days
  for select to authenticated
  using (owner_id = (select auth.uid()));

-- A foreign key is checked without row level security, so without the `exists` subquery a person
-- could hang a day on another person's plan and learn whether the id exists. The subquery runs as the
-- caller, under the owner-only `meal_plans` policy.
create policy "meal_plan_days_insert_own" on public.meal_plan_days
  for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.meal_plans p where p.id = meal_plan_days.plan_id)
  );

create policy "meal_plan_days_update_own" on public.meal_plan_days
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "meal_plan_items_select_own" on public.meal_plan_items
  for select to authenticated
  using (owner_id = (select auth.uid()));

-- The same reason as above, for each reference an item can hold: the day must be the caller's, a food
-- one the caller can see, a recipe one the caller owns (the `recipes` policy is owner-only), and a
-- portion one the caller can see, exactly as the `food_log_entries` policy checks it. Without the portion
-- clause a person could name another person's private portion and learn that the id exists. The cooking
-- item is checked by the composite key on the table.
create policy "meal_plan_items_insert_own" on public.meal_plan_items
  for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.meal_plan_days d where d.id = meal_plan_items.day_id)
    and (food_id is null or exists (select 1 from public.foods f where f.id = meal_plan_items.food_id))
    and (recipe_id is null or exists (select 1 from public.recipes r where r.id = meal_plan_items.recipe_id))
    and (portion_id is null or exists (select 1 from public.food_portions p where p.id = meal_plan_items.portion_id))
  );

create policy "meal_plan_items_delete_own" on public.meal_plan_items
  for delete to authenticated
  using (owner_id = (select auth.uid()));

-- Replaces the items of one day, all or nothing. A confirmed day is refused, because it is a record of
-- what was written to the diary.
--
-- Input. p_items is an array of at most 200 objects with position, slot_time, item_type, food_id,
-- recipe_id, servings, grams, portion_id, nutrients and snapshot, which core built. A leftover also
-- names the item that cooked it by `leftover_of_position` and, when that item is on another day of the
-- plan, by `leftover_of_day` (a date, the day of this item when absent). The database gives items their
-- ids, so a leftover cannot name one, and the cooking item must already be in the plan. A leftover must
-- name its cook, not another leftover. Keys the
-- function does not know (owner_id, id, created_at) are ignored, so the owner is the caller.
--
-- Replacing the day of a cook deletes the cook, so the foreign key sets `leftover_of` to null on the
-- leftovers of later days. The replan tool (KEY-1033) must handle those dependants.
--
-- Security invoker, so every policy above applies. The day row is locked first, so two calls on one day
-- run one after the other.
create function public.replace_meal_plan_day(p_day_id uuid, p_items jsonb)
returns void
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_day record;
  v_leftovers integer;
  v_written integer;
begin
  if pg_catalog.jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'replace_meal_plan_day needs the items as a JSON array'
      using errcode = '22023';
  end if;
  if pg_catalog.jsonb_array_length(p_items) > 200 then
    raise exception 'a day holds at most 200 items'
      using errcode = '22023';
  end if;
  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_items) as item
    where pg_catalog.jsonb_typeof(item) is distinct from 'object'
  ) then
    raise exception 'every item must be a JSON object'
      using errcode = '22023';
  end if;

  select d.plan_id, d.local_date, d.confirmed_at
  into v_day
  from public.meal_plan_days d
  where d.id = p_day_id
  for update;

  if not found then
    raise exception 'the day was not found'
      using errcode = '22023';
  end if;
  if v_day.confirmed_at is not null then
    raise exception 'a confirmed day cannot be replaced'
      using errcode = '22023';
  end if;

  delete from public.meal_plan_items where day_id = p_day_id;

  -- The items that cooked something, and every other item, go in first.
  insert into public.meal_plan_items (
    day_id, position, slot_time, item_type, food_id, recipe_id, servings, grams, portion_id,
    nutrients, snapshot
  )
  select
    p_day_id, item.position, item.slot_time, item.item_type, item.food_id, item.recipe_id,
    item.servings, item.grams, item.portion_id, item.nutrients, item.snapshot
  from pg_catalog.jsonb_to_recordset(p_items) as item(
    position integer, slot_time time, item_type text, food_id uuid, recipe_id uuid, servings numeric,
    grams numeric, portion_id uuid, nutrients jsonb, snapshot jsonb, leftover_of_position integer
  )
  where item.leftover_of_position is null;

  -- The leftovers follow, so the policy that checks a cooking item sees the rows above. A leftover whose
  -- cooking item is not found is not written, and the count below refuses the call.
  select pg_catalog.count(*) into v_leftovers
  from pg_catalog.jsonb_to_recordset(p_items) as item(leftover_of_position integer)
  where item.leftover_of_position is not null;

  insert into public.meal_plan_items (
    day_id, position, slot_time, item_type, food_id, recipe_id, servings, grams, portion_id,
    nutrients, leftover_of, snapshot
  )
  select
    p_day_id, item.position, item.slot_time, item.item_type, item.food_id, item.recipe_id,
    item.servings, item.grams, item.portion_id, item.nutrients, cooking.id, item.snapshot
  from pg_catalog.jsonb_to_recordset(p_items) as item(
    position integer, slot_time time, item_type text, food_id uuid, recipe_id uuid, servings numeric,
    grams numeric, portion_id uuid, nutrients jsonb, snapshot jsonb, leftover_of_day date,
    leftover_of_position integer
  )
  cross join lateral (
    select i.id
    from public.meal_plan_days d
    join public.meal_plan_items i on i.day_id = d.id
    where d.plan_id = v_day.plan_id
      and d.local_date = coalesce(item.leftover_of_day, v_day.local_date)
      and i.position = item.leftover_of_position
    order by i.id
    limit 1
  ) as cooking
  where item.leftover_of_position is not null;

  get diagnostics v_written = row_count;
  if v_written is distinct from v_leftovers then
    raise exception 'a leftover must name an item that is already in the plan'
      using errcode = '22023';
  end if;
end;
$$;

-- Writes a plan, its days and its items in one call, all or nothing, and returns the new plan's id.
--
-- Input. p_plan is an object with start_date, day_count, rules and source. p_days is an array of
-- objects with local_date and target, and its length must equal day_count. p_items is an array of at
-- most 500 objects of the shape `replace_meal_plan_day` takes, each with the `local_date` of the day it
-- belongs to, because the days have no ids until this call writes them. Keys the function does not
-- know are ignored.
--
-- The days are written in date order, each through `replace_meal_plan_day`, so a leftover can name an
-- item of its own day or of an earlier one. Security invoker, so every policy applies, and any refusal
-- rolls the whole call back.
create function public.save_meal_plan(p_plan jsonb, p_days jsonb, p_items jsonb)
returns uuid
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_plan_id uuid;
  v_day record;
  v_day_count integer;
begin
  if pg_catalog.jsonb_typeof(p_plan) is distinct from 'object' then
    raise exception 'save_meal_plan needs the plan as a JSON object'
      using errcode = '22023';
  end if;
  if pg_catalog.jsonb_typeof(p_days) is distinct from 'array'
    or pg_catalog.jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'save_meal_plan needs the days and the items as JSON arrays'
      using errcode = '22023';
  end if;
  if pg_catalog.jsonb_array_length(p_items) > 500 then
    raise exception 'a plan holds at most 500 items'
      using errcode = '22023';
  end if;
  if exists (
    select 1
    from (
      select element from pg_catalog.jsonb_array_elements(p_days) as element
      union all
      select element from pg_catalog.jsonb_array_elements(p_items) as element
    ) as elements
    where pg_catalog.jsonb_typeof(elements.element) is distinct from 'object'
  ) then
    raise exception 'every day and every item must be a JSON object'
      using errcode = '22023';
  end if;

  v_day_count := (p_plan ->> 'day_count')::integer;
  if v_day_count is distinct from pg_catalog.jsonb_array_length(p_days) then
    raise exception 'day_count must equal the number of days'
      using errcode = '22023';
  end if;

  -- Every item must belong to one of the days.
  if exists (
    select 1
    from pg_catalog.jsonb_to_recordset(p_items) as item(local_date date)
    where item.local_date is null
      or not exists (
        select 1
        from pg_catalog.jsonb_to_recordset(p_days) as plan_day(local_date date)
        where plan_day.local_date = item.local_date
      )
  ) then
    raise exception 'every item must name a day of the plan'
      using errcode = '22023';
  end if;

  insert into public.meal_plans (start_date, day_count, rules, source)
  select plan.start_date, plan.day_count, plan.rules, plan.source
  from pg_catalog.jsonb_to_record(p_plan) as plan(
    start_date date, day_count smallint, rules jsonb, source text
  )
  returning id into v_plan_id;

  insert into public.meal_plan_days (plan_id, local_date, target)
  select v_plan_id, plan_day.local_date, plan_day.target
  from pg_catalog.jsonb_to_recordset(p_days) as plan_day(local_date date, target jsonb);

  for v_day in
    select d.id, d.local_date
    from public.meal_plan_days d
    where d.plan_id = v_plan_id
    order by d.local_date
  loop
    perform public.replace_meal_plan_day(
      v_day.id,
      (
        select coalesce(pg_catalog.jsonb_agg(element.item order by element.item_order), '[]'::jsonb)
        from pg_catalog.jsonb_array_elements(p_items) with ordinality as element(item, item_order)
        where (element.item ->> 'local_date')::date = v_day.local_date
      )
    );
  end loop;

  return v_plan_id;
end;
$$;

-- Writes the diary entries of a day, stamps the day as confirmed with their ids, and returns the ids in
-- the order given, all in one transaction. The day row is locked first and a day that is already
-- confirmed is refused, so two taps cannot write a day twice.
--
-- Input. p_entries is a non-empty array of at most 200 objects, each a `food_log_entries` row that core
-- built with `buildLogEntry`, `buildRecipeLogEntry` or `buildQuickEntry` at the moment of confirming,
-- so the snapshots and nutrients are core's and fresh, and the database computes none. An entry must be
-- on the day's own date. Keys the function does not know (user_id, id, created_at) are ignored, so the
-- owner is the caller.
--
-- Security invoker, and the rows go through the same policies and column grants as any diary write, so
-- the diary rules apply unchanged.
create function public.confirm_meal_plan_day(p_day_id uuid, p_entries jsonb)
returns uuid[]
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_day record;
  v_entry record;
  v_entry_id uuid;
  v_entry_ids uuid[] := '{}';
begin
  if pg_catalog.jsonb_typeof(p_entries) is distinct from 'array' then
    raise exception 'confirm_meal_plan_day needs the entries as a JSON array'
      using errcode = '22023';
  end if;
  if pg_catalog.jsonb_array_length(p_entries) = 0 then
    raise exception 'a day is confirmed with at least one entry'
      using errcode = '22023';
  end if;
  if pg_catalog.jsonb_array_length(p_entries) > 200 then
    raise exception 'a day is confirmed with at most 200 entries'
      using errcode = '22023';
  end if;
  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_entries) as entry
    where pg_catalog.jsonb_typeof(entry) is distinct from 'object'
  ) then
    raise exception 'every entry must be a JSON object'
      using errcode = '22023';
  end if;

  select d.local_date, d.confirmed_at
  into v_day
  from public.meal_plan_days d
  where d.id = p_day_id
  for update;

  if not found then
    raise exception 'the day was not found'
      using errcode = '22023';
  end if;
  if v_day.confirmed_at is not null then
    raise exception 'the day is already confirmed'
      using errcode = '22023';
  end if;

  -- One insert per entry, so the ids come back in the order given.
  for v_entry in
    select entry.*
    from pg_catalog.jsonb_array_elements(p_entries) with ordinality as element(item, item_order)
    cross join lateral pg_catalog.jsonb_to_record(element.item) as entry(
      local_date date, logged_at timestamptz, item_type text, food_id uuid, recipe_id uuid,
      quantity numeric, unit text, portion_id uuid, resolved_grams numeric, snapshot jsonb,
      nutrients jsonb
    )
    order by element.item_order
  loop
    if v_entry.local_date is distinct from v_day.local_date then
      raise exception 'an entry must be on the day it confirms'
        using errcode = '22023';
    end if;

    insert into public.food_log_entries (
      local_date, logged_at, item_type, food_id, recipe_id, quantity, unit, portion_id,
      resolved_grams, snapshot, nutrients
    )
    values (
      v_entry.local_date, v_entry.logged_at, v_entry.item_type::public.log_item_type, v_entry.food_id,
      v_entry.recipe_id, v_entry.quantity, v_entry.unit, v_entry.portion_id, v_entry.resolved_grams,
      v_entry.snapshot, v_entry.nutrients
    )
    returning id into v_entry_id;

    v_entry_ids := v_entry_ids || v_entry_id;
  end loop;

  update public.meal_plan_days
  set confirmed_at = pg_catalog.now(), confirmed_entry_ids = v_entry_ids
  where id = p_day_id;

  return v_entry_ids;
end;
$$;

-- `create function` grants execute to public, and the Supabase default ACL grants it to the API
-- roles, so each is revoked by name. The functions act on the caller, so only authenticated holds them.
revoke execute on function public.save_meal_plan(jsonb, jsonb, jsonb) from public, anon, service_role;
grant execute on function public.save_meal_plan(jsonb, jsonb, jsonb) to authenticated;

revoke execute on function public.replace_meal_plan_day(uuid, jsonb) from public, anon, service_role;
grant execute on function public.replace_meal_plan_day(uuid, jsonb) to authenticated;

revoke execute on function public.confirm_meal_plan_day(uuid, jsonb) from public, anon, service_role;
grant execute on function public.confirm_meal_plan_day(uuid, jsonb) to authenticated;
