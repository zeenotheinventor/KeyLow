-- Atomic portion writes (KEY-946). Two functions that write a person's own food and its portions in
-- one transaction, and a tighter store_off_product. Together they keep every food on a default portion.
--
-- The repository used to write a food's portions in separate PostgREST calls, which have no
-- transaction between them. `createFood` inserted the food and then its portions, so a failed portions
-- insert left a food with none. `replaceFoodPortions` deleted the old portions and then inserted the
-- new ones, so a failed insert left a healthy food with none. A food with no default opens on a silent
-- 100 g (KEY-934), so neither is acceptable.
--
-- Both functions are security invoker, so row level security and the column grants apply exactly as they
-- do to the direct inserts and deletes they replace. Nothing here widens what a signed in person can write.
-- Every name is schema qualified under an empty search_path, as the other functions here do.
--
-- Errors carry a code and a message that states a rule and quotes no value, because a row can hold health
-- data. 22023 is a refused payload, P0002 is a food the caller cannot see, 42501 is a food they cannot edit.
-- Anything the tables refuse (a portion with both grams and ml, a second default) is the table's own error,
-- and the whole call rolls back.

-- Replaces every portion of one of the caller's own foods with the given list, in one transaction. The
-- list is an array of { label, grams, ml, is_default }, stored in the order sent. It must hold at least one
-- portion and exactly one default, so a food can never be left with none. The caller's own foods are the
-- only ones it can change: a shared food is refused with 42501, and a food the caller cannot see is
-- refused with P0002, the same answer for another person's food and for one that does not exist.
-- A failed insert rolls the delete back, so the old portions stay. Returns the stored portions in order, as a JSON array of rows.
create function public.replace_food_portions(p_food_id uuid, p_portions jsonb)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  food_owner uuid;
  stored_portions jsonb;
begin
  if pg_catalog.jsonb_typeof(p_portions) is distinct from 'array' then
    raise exception 'replace_food_portions needs the portions as a JSON array'
      using errcode = '22023';
  end if;
  if (
    select pg_catalog.count(*)
    from pg_catalog.jsonb_array_elements(p_portions) as portion
    where coalesce((portion ->> 'is_default')::boolean, false)
  ) <> 1 then
    raise exception 'replace_food_portions needs exactly one default portion'
      using errcode = '22023';
  end if;

  select food.owner_id into food_owner
  from public.foods food
  where food.id = p_food_id;

  if not found then
    raise exception 'replace_food_portions could not find the food'
      using errcode = 'P0002';
  end if;
  if food_owner is null then
    raise exception 'replace_food_portions only changes the caller''s own foods'
      using errcode = '42501';
  end if;

  delete from public.food_portions where food_id = p_food_id;

  with inserted as (
    insert into public.food_portions (food_id, owner_id, label, grams, ml, is_default, position)
    select
      p_food_id,
      food_owner,
      portion.label,
      portion.grams,
      portion.ml,
      coalesce(portion.is_default, false),
      (element.number - 1)::integer
    from pg_catalog.jsonb_array_elements(p_portions) with ordinality as element(item, number),
      lateral pg_catalog.jsonb_populate_record(null::public.food_portions, element.item) as portion
    returning *
  )
  select coalesce(
    pg_catalog.jsonb_agg(pg_catalog.to_jsonb(inserted) order by inserted.position),
    '[]'::jsonb
  )
  into stored_portions
  from inserted;

  return stored_portions;
end;
$$;

revoke execute on function public.replace_food_portions(uuid, jsonb) from public, anon;
grant execute on function public.replace_food_portions(uuid, jsonb) to authenticated, service_role;

-- Creates one of the caller's own foods and its portions in one transaction, so a failed portions insert
-- leaves no food behind. p_food holds the columns the form writes plus `source` ('user') and `owner_id`,
-- and a key it does not list is ignored. Row level security decides who may write the food, as it does for
-- a direct insert, so another person's owner_id or a source other than 'user' is refused with 42501. The
-- portions are written by replace_food_portions, so the same rules apply to them. Returns { food, portions },
-- the stored food (every column except the generated `search`) and its portions in order.
create function public.create_food(p_food jsonb, p_portions jsonb)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  incoming public.foods;
  created public.foods;
  stored_portions jsonb;
begin
  if pg_catalog.jsonb_typeof(p_food) is distinct from 'object' then
    raise exception 'create_food needs the food as a JSON object'
      using errcode = '22023';
  end if;

  incoming := pg_catalog.jsonb_populate_record(null::public.foods, p_food);

  insert into public.foods (
    source, owner_id, name, brand, barcode, basis, density_g_per_ml,
    kcal, protein_g, fat_g, sat_fat_g, carbs_g, sugars_g, fibre_g, salt_g, micros
  )
  values (
    incoming.source, incoming.owner_id, incoming.name, incoming.brand, incoming.barcode,
    incoming.basis, incoming.density_g_per_ml,
    incoming.kcal, incoming.protein_g, incoming.fat_g, incoming.sat_fat_g, incoming.carbs_g,
    incoming.sugars_g, incoming.fibre_g, incoming.salt_g, coalesce(incoming.micros, '{}'::jsonb)
  )
  returning * into created;

  stored_portions := public.replace_food_portions(created.id, p_portions);

  return pg_catalog.jsonb_build_object(
    'food', pg_catalog.to_jsonb(created) - 'search',
    'portions', stored_portions
  );
end;
$$;

revoke execute on function public.create_food(jsonb, jsonb) from public, anon;
grant execute on function public.create_food(jsonb, jsonb) to authenticated, service_role;

-- store_off_product refuses a product whose portions have no default, as well as one with two. It used to
-- refuse only a second default and accept none, so a product with no default opened on a silent 100 g. The
-- Edge Function always sends one (core's deriveOffPortions ends on an estimate), so a payload without one is
-- a bug upstream and is refused before anything is written. The rest of the function is unchanged.
create or replace function public.store_off_product(p_food jsonb, p_portions jsonb, p_raw jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  incoming public.foods;
  stored_food public.foods;
  stored_portions jsonb;
begin
  if pg_catalog.jsonb_typeof(p_food) is distinct from 'object' then
    raise exception 'store_off_product needs the food as a JSON object'
      using errcode = '22023';
  end if;
  if pg_catalog.jsonb_typeof(p_portions) is distinct from 'array' then
    raise exception 'store_off_product needs the portions as a JSON array'
      using errcode = '22023';
  end if;
  if pg_catalog.jsonb_typeof(p_raw) is distinct from 'object' then
    raise exception 'store_off_product needs the raw product as a JSON object'
      using errcode = '22023';
  end if;

  -- The columns of foods that have a type are read with that type, so a value of the wrong kind is
  -- refused by the cast and not stored as something else.
  incoming := pg_catalog.jsonb_populate_record(null::public.foods, p_food);

  if incoming.source is distinct from 'off' then
    raise exception 'store_off_product only stores Open Food Facts foods'
      using errcode = '22023';
  end if;
  if incoming.owner_id is not null then
    raise exception 'store_off_product only stores global foods, so owner_id must be absent or null'
      using errcode = '22023';
  end if;
  if pg_catalog.btrim(coalesce(incoming.source_ref, '')) = '' then
    raise exception 'store_off_product needs a source_ref'
      using errcode = '22023';
  end if;
  if (
    select pg_catalog.count(*)
    from pg_catalog.jsonb_array_elements(p_portions) as portion
    where coalesce((portion ->> 'is_default')::boolean, false)
  ) > 1 then
    raise exception 'store_off_product accepts at most one default portion'
      using errcode = '22023';
  end if;
  if not exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_portions) as portion
    where coalesce((portion ->> 'is_default')::boolean, false)
  ) then
    raise exception 'store_off_product needs a default portion'
      using errcode = '22023';
  end if;

  -- The first write, and the lock every other writer of this barcode queues behind.
  insert into public.foods (
    source, source_ref, owner_id, name, brand, barcode, basis, density_g_per_ml,
    kcal, protein_g, fat_g, sat_fat_g, carbs_g, sugars_g, fibre_g, salt_g,
    micros, quality, food_group, fetched_at
  )
  values (
    'off', incoming.source_ref, null, incoming.name, incoming.brand, incoming.barcode,
    incoming.basis, incoming.density_g_per_ml,
    incoming.kcal, incoming.protein_g, incoming.fat_g, incoming.sat_fat_g, incoming.carbs_g,
    incoming.sugars_g, incoming.fibre_g, incoming.salt_g,
    incoming.micros, incoming.quality, incoming.food_group, pg_catalog.clock_timestamp()
  )
  on conflict (source, source_ref) do update set
    name = excluded.name,
    brand = excluded.brand,
    barcode = excluded.barcode,
    basis = excluded.basis,
    density_g_per_ml = excluded.density_g_per_ml,
    kcal = excluded.kcal,
    protein_g = excluded.protein_g,
    fat_g = excluded.fat_g,
    sat_fat_g = excluded.sat_fat_g,
    carbs_g = excluded.carbs_g,
    sugars_g = excluded.sugars_g,
    fibre_g = excluded.fibre_g,
    salt_g = excluded.salt_g,
    micros = excluded.micros,
    quality = excluded.quality,
    food_group = excluded.food_group,
    fetched_at = excluded.fetched_at
  returning * into stored_food;

  insert into public.food_source_data (food_id, import_run_id, raw)
  values (stored_food.id, null, p_raw)
  on conflict (food_id) do update set
    import_run_id = excluded.import_run_id,
    raw = excluded.raw;

  delete from public.food_portions where food_id = stored_food.id;

  with inserted as (
    insert into public.food_portions (food_id, owner_id, label, grams, ml, is_default, position)
    select
      stored_food.id,
      null,
      portion.label,
      portion.grams,
      portion.ml,
      coalesce(portion.is_default, false),
      (element.number - 1)::integer
    from pg_catalog.jsonb_array_elements(p_portions) with ordinality as element(item, number),
      lateral pg_catalog.jsonb_populate_record(null::public.food_portions, element.item) as portion
    returning *
  )
  select coalesce(
    pg_catalog.jsonb_agg(pg_catalog.to_jsonb(inserted) order by inserted.position),
    '[]'::jsonb
  )
  into stored_portions
  from inserted;

  return pg_catalog.jsonb_build_object(
    'food', pg_catalog.to_jsonb(stored_food) - 'search',
    'portions', stored_portions
  );
end;
$$;
