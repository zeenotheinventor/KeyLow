-- store_off_product: stores an Open Food Facts product in one transaction, for the off-product Edge
-- Function (KEY-60). Set out in docs/adr/0003-data-model.md, Amendment 7.
--
-- The function did this with three PostgREST calls, which have no transaction between them: a reader
-- could see a fresh food with no portions, a portions insert that failed after the delete left the food
-- without portions until its next refresh, and simultaneous first lookups collided on the portions
-- insert. Here the food upsert, the portions replacement and the raw data upsert are one statement
-- sequence inside the caller's transaction, so all of it happens or none of it does.
--
-- Concurrency. Two calls for one barcode are serialised by the row lock the food upsert takes, and
-- no advisory lock is needed. `insert ... on conflict do update` on (source, source_ref) either
-- inserts the row or locks the existing one until the transaction ends. A second writer waits at that
-- statement for the first to commit, then takes the update branch and only then deletes and inserts
-- the portions, in a new statement that sees what the first committed. So the portions insert never
-- finds another writer's default portion, no unique violation can escape, and the last writer wins.
-- That is why the upsert must stay the first write. Every writer takes locks in the same order (the
-- food, then its raw data, then its portions), so two writers cannot deadlock.
--
-- Input is JSON, because it is the shape the Edge Function already holds:
--   p_food      the columns of foods the OFF normaliser fills, plus `source` ('off') and `source_ref`.
--               Other keys are ignored. `owner_id` must be absent or null. `fetched_at` is the
--               database's to set, so a sent value is ignored.
--   p_portions  an array of { label, grams, ml, is_default }, stored in the order sent as the food's
--               global portions. An empty array means the product has none.
--   p_raw       the product as OFF sent it, kept in food_source_data.
-- It returns { food, portions }: the stored food (every column except the generated `search`) and its
-- portions in order, which is the body the Edge Function answers with.
--
-- A payload that is not an object, is not an off food, has an owner, has no source_ref or has more than
-- one default portion is refused with 22023 before anything is written. Anything the tables refuse
-- (a portion with both grams and ml, a negative amount) is the table's own error, and the whole call
-- rolls back.
--
-- Security definer, because the service role has no reason to hold more than select, insert, update and
-- delete (Amendment 6), and an empty search_path with every name schema-qualified, as the other
-- definer functions here do. row_security is off so a policy can never silently hide the row being
-- updated: the function either sees it or fails.
create function public.store_off_product(p_food jsonb, p_portions jsonb, p_raw jsonb)
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
    where (portion ->> 'is_default')::boolean
  ) > 1 then
    raise exception 'store_off_product accepts at most one default portion'
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

-- Only the Edge Function, through the service role, stores an OFF product. `create function` grants
-- execute to public, so it is revoked from public and from the API roles by name.
revoke execute on function public.store_off_product(jsonb, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.store_off_product(jsonb, jsonb, jsonb) to service_role;
