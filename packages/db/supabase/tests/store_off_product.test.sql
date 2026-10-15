-- Asserts public.store_off_product() (ADR 0003 Amendment 7): the one transaction in which the
-- off-product Edge Function stores an Open Food Facts product. It upserts the food, replaces the
-- food's global portions and upserts its raw data, so a reader never sees a food without its portions
-- and a failure partway leaves what was stored before untouched.
--
-- `supabase test db` runs this file as postgres inside a transaction that is rolled back, so nothing
-- created here persists. Every source_ref is unique to this file. The function is entered as
-- service_role, the only role that may execute it. A statement that fails inside throws_ok runs in
-- its own savepoint, which is what makes "the failure rolled everything back" checkable here.
--
-- Two writers racing for one barcode cannot be shown in one transaction, so that is asserted by
-- test/integration/database/store-off-product.test.ts, which uses two connections.

begin;

select plan(45);

-- The food payload the Edge Function sends: the columns the normaliser fills, plus source and
-- source_ref. fetched_at is the database's to set.
create function pg_temp.off_food(reference text, food_name text) returns jsonb
language sql
as $$
  select pg_catalog.jsonb_build_object(
    'source', 'off',
    'source_ref', reference,
    'name', food_name,
    'brand', 'Test Brand',
    'barcode', reference,
    'basis', 'per_100g',
    'density_g_per_ml', null,
    'kcal', 400,
    'protein_g', 10,
    'fat_g', 5,
    'sat_fat_g', 1,
    'carbs_g', 70,
    'sugars_g', 20,
    'fibre_g', 6,
    'salt_g', 0.5,
    'micros', pg_catalog.jsonb_build_object('calcium_mg', 12),
    'quality', pg_catalog.jsonb_build_object('suspect', false),
    'food_group', 'cereals'
  )
$$;

create function pg_temp.portion(portion_label text, grams numeric, is_default boolean)
returns jsonb
language sql
as $$
  select pg_catalog.jsonb_build_object(
    'label', portion_label, 'grams', grams, 'ml', null, 'is_default', is_default
  )
$$;

-- Function attributes and privileges.
select ok(
  (select prosecdef from pg_proc where oid = 'public.store_off_product(jsonb, jsonb, jsonb)'::regprocedure),
  'store_off_product is security definer'
);

select ok(
  (select proconfig @> array['search_path=""'] from pg_proc where oid = 'public.store_off_product(jsonb, jsonb, jsonb)'::regprocedure),
  'store_off_product pins an empty search_path'
);

select ok(
  (select proconfig @> array['row_security=off'] from pg_proc where oid = 'public.store_off_product(jsonb, jsonb, jsonb)'::regprocedure),
  'store_off_product turns row_security off, so it fails loudly instead of silently hiding rows'
);

select is(
  (
    select array_agg(role_name order by role_name)
    from unnest(array['anon', 'authenticated', 'service_role']) as role_name
    where has_function_privilege(role_name, 'public.store_off_product(jsonb, jsonb, jsonb)', 'execute')
  ),
  array['service_role'],
  'only service_role can execute store_off_product'
);

select ok(
  not has_function_privilege('public', 'public.store_off_product(jsonb, jsonb, jsonb)', 'execute'),
  'public cannot execute store_off_product'
);

set local role authenticated;
select throws_ok(
  $$ select public.store_off_product(pg_temp.off_food('50600000000001', 'Nope'), '[]', '{}') $$,
  '42501',
  null,
  'a signed in user cannot call store_off_product'
);
reset role;

set local role anon;
select throws_ok(
  $$ select public.store_off_product(pg_temp.off_food('50600000000001', 'Nope'), '[]', '{}') $$,
  '42501',
  null,
  'an anonymous caller cannot call store_off_product'
);
reset role;

-- A fresh store. The results are kept in tables so that later checks can compare against them.
set local role service_role;

create temporary table first_result as
select public.store_off_product(
  pg_temp.off_food('50600000000010', 'Oat crunch'),
  pg_catalog.jsonb_build_array(pg_temp.portion('40 g', 40, true), pg_temp.portion('1 bowl', 80, false)),
  '{"code": "50600000000010", "product_name": "Oat crunch"}'
) as result;

select is(
  (select count(*)::int from public.foods where source = 'off' and source_ref = '50600000000010'),
  1,
  'a fresh store creates the food'
);

select is(
  (select pg_catalog.jsonb_build_object('owner', owner_id, 'name', name, 'brand', brand, 'barcode', barcode,
     'basis', basis, 'kcal', kcal, 'salt_g', salt_g, 'micros', micros, 'quality', quality, 'food_group', food_group,
     'fetched', fetched_at is not null, 'deleted', deleted_at)
   from public.foods where source_ref = '50600000000010'),
  pg_catalog.jsonb_build_object('owner', null, 'name', 'Oat crunch', 'brand', 'Test Brand',
    'barcode', '50600000000010', 'basis', 'per_100g', 'kcal', 400, 'salt_g', 0.5,
    'micros', '{"calcium_mg": 12}'::jsonb, 'quality', '{"suspect": false}'::jsonb, 'food_group', 'cereals',
    'fetched', true, 'deleted', null),
  'the food is global, carries the sent columns and has a fetch time'
);

select is(
  (select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('label', label, 'grams', grams, 'ml', ml, 'is_default', is_default, 'position', position, 'owner', owner_id) order by position)
   from public.food_portions where food_id = (select id from public.foods where source_ref = '50600000000010')),
  '[{"label": "40 g", "grams": 40, "ml": null, "is_default": true, "position": 0, "owner": null},
    {"label": "1 bowl", "grams": 80, "ml": null, "is_default": false, "position": 1, "owner": null}]'::jsonb,
  'a fresh store creates the portions as global rows, in the order sent'
);

select is(
  (select pg_catalog.jsonb_build_object('raw', raw, 'run', import_run_id)
   from public.food_source_data where food_id = (select id from public.foods where source_ref = '50600000000010')),
  '{"raw": {"code": "50600000000010", "product_name": "Oat crunch"}, "run": null}'::jsonb,
  'a fresh store keeps the raw product, without an import run'
);

select is(
  (select result -> 'food' ->> 'id' from first_result),
  (select id::text from public.foods where source_ref = '50600000000010'),
  'the result carries the stored food'
);

select is(
  (select result -> 'food' ? 'search' from first_result),
  false,
  'the generated search column does not leave the database'
);

select is(
  (select pg_catalog.to_jsonb(f) - 'search' from public.foods f where f.source_ref = '50600000000010'),
  (select result -> 'food' from first_result),
  'the food in the result is the stored row, whole'
);

select is(
  (select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(p) order by p.position) from public.food_portions p
   where p.food_id = (select id from public.foods where source_ref = '50600000000010')),
  (select result -> 'portions' from first_result),
  'the portions in the result are the stored rows, whole and in order'
);

-- A second call for the same barcode updates the food and does not duplicate anything.
reset role;
update public.foods
set fetched_at = '2026-01-01T00:00:00Z', created_at = '2026-01-01T00:00:00Z'
where source_ref = '50600000000010';
create temporary table old_portion_ids as
select id from public.food_portions
where food_id = (select id from public.foods where source_ref = '50600000000010');
grant select on old_portion_ids to service_role;
set local role service_role;

create temporary table second_result as
select public.store_off_product(
  pg_temp.off_food('50600000000010', 'Oat crunch, new recipe'),
  pg_catalog.jsonb_build_array(pg_temp.portion('50 g', 50, true)),
  '{"code": "50600000000010", "product_name": "Oat crunch, new recipe"}'
) as result;

select is(
  (select count(*)::int from public.foods where source = 'off' and source_ref = '50600000000010'),
  1,
  'a second store with the same source_ref does not duplicate the food'
);

select is(
  (select result -> 'food' ->> 'id' from second_result),
  (select result -> 'food' ->> 'id' from first_result),
  'a second store keeps the food id'
);

select is(
  (select name from public.foods where source_ref = '50600000000010'),
  'Oat crunch, new recipe',
  'a second store updates the columns'
);

select is(
  (select created_at from public.foods where source_ref = '50600000000010'),
  '2026-01-01T00:00:00Z'::timestamptz,
  'a second store leaves created_at alone'
);

select cmp_ok(
  (select fetched_at from public.foods where source_ref = '50600000000010'),
  '>',
  '2026-01-01T00:00:00Z'::timestamptz,
  'a second store moves fetched_at forward'
);

select is(
  (select count(*)::int from public.food_source_data
   where food_id = (select id from public.foods where source_ref = '50600000000010')),
  1,
  'a second store does not duplicate the raw data'
);

select is(
  (select raw ->> 'product_name' from public.food_source_data
   where food_id = (select id from public.foods where source_ref = '50600000000010')),
  'Oat crunch, new recipe',
  'a second store replaces the raw data'
);

-- A refresh replaces the portions. One statement cannot observe a window with no portions, so the end
-- state is what is asserted: the new portions are there and not one of the old rows is left.
select is(
  (select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('label', label, 'grams', grams, 'is_default', is_default, 'position', position) order by position)
   from public.food_portions where food_id = (select id from public.foods where source_ref = '50600000000010')),
  '[{"label": "50 g", "grams": 50, "is_default": true, "position": 0}]'::jsonb,
  'a refresh leaves exactly the new portions'
);

select is(
  (select count(*)::int from public.food_portions where id in (select id from old_portion_ids)),
  0,
  'a refresh leaves none of the old portion rows'
);

select is(
  (select pg_catalog.jsonb_array_length(result -> 'portions') from second_result),
  1,
  'the result of a refresh carries only the new portions'
);

-- A product with no serving has no portions, and a refresh clears the old ones.
select lives_ok(
  $$ select public.store_off_product(pg_temp.off_food('50600000000010', 'Oat crunch, new recipe'), '[]', '{"code": "50600000000010"}') $$,
  'a refresh with no portions is accepted'
);

select is(
  (select count(*)::int from public.food_portions where food_id = (select id from public.foods where source_ref = '50600000000010')),
  0,
  'a refresh with no portions leaves the food with none'
);

select is(
  (select public.store_off_product(pg_temp.off_food('50600000000011', 'Bare product'), '[]', '{}') -> 'portions'),
  '[]'::jsonb,
  'a fresh store with no portions returns an empty list, never null'
);

-- A failure partway rolls everything back. The payloads below pass the function's own checks and fail
-- at the portions insert, after the food was upserted and the old portions deleted.
select public.store_off_product(
  pg_temp.off_food('50600000000020', 'Original name'),
  pg_catalog.jsonb_build_array(pg_temp.portion('30 g', 30, true), pg_temp.portion('2 pieces', 60, false)),
  '{"version": 1}'
);

select throws_ok(
  $$ select public.store_off_product(
       pg_temp.off_food('50600000000020', 'Changed name'),
       '[{"label": "20 g", "grams": 20, "ml": null, "is_default": true},
         {"label": "both", "grams": 5, "ml": 5, "is_default": false}]',
       '{"version": 2}') $$,
  '23514',
  null,
  'a portion with both grams and ml fails the whole store'
);

select is(
  (select name from public.foods where source_ref = '50600000000020'),
  'Original name',
  'after a failed refresh the food still has its old columns'
);

select is(
  (select pg_catalog.jsonb_agg(label order by position) from public.food_portions
   where food_id = (select id from public.foods where source_ref = '50600000000020')),
  '["30 g", "2 pieces"]'::jsonb,
  'after a failed refresh the food still has its old portions'
);

select is(
  (select raw ->> 'version' from public.food_source_data
   where food_id = (select id from public.foods where source_ref = '50600000000020')),
  '1',
  'after a failed refresh the food still has its old raw data'
);

select throws_ok(
  $$ select public.store_off_product(
       pg_temp.off_food('50600000000021', 'Never stored'),
       '[{"label": "bad", "grams": -1, "ml": null, "is_default": true}]',
       '{}') $$,
  '23514',
  null,
  'a portion that breaks its check fails a first store'
);

select is(
  (select count(*)::int from public.foods where source_ref = '50600000000021'),
  0,
  'a failed first store leaves no food behind'
);

-- Input checks. Each runs before anything is written.
select throws_ok(
  $$ select public.store_off_product(pg_temp.off_food('50600000000020', 'Cofid') || '{"source": "cofid"}', '[]', '{}') $$,
  '22023',
  'store_off_product only stores Open Food Facts foods',
  'a food that is not an off food is refused'
);

select throws_ok(
  $$ select public.store_off_product(pg_temp.off_food('50600000000020', 'Owned') || '{"owner_id": "64000003-0000-4000-8000-00000000000b"}', '[]', '{}') $$,
  '22023',
  'store_off_product only stores global foods, so owner_id must be absent or null',
  'a food with an owner is refused'
);

select throws_ok(
  $$ select public.store_off_product(pg_temp.off_food('50600000000020', 'No ref') - 'source_ref', '[]', '{}') $$,
  '22023',
  'store_off_product needs a source_ref',
  'a food without a source_ref is refused'
);

select throws_ok(
  $$ select public.store_off_product(pg_temp.off_food('   ', 'Blank ref'), '[]', '{}') $$,
  '22023',
  'store_off_product needs a source_ref',
  'a blank source_ref is refused'
);

select throws_ok(
  $$ select public.store_off_product('[]', '[]', '{}') $$,
  '22023',
  'store_off_product needs the food as a JSON object',
  'a food that is not an object is refused'
);

select throws_ok(
  $$ select public.store_off_product(null, '[]', '{}') $$,
  '22023',
  'store_off_product needs the food as a JSON object',
  'a null food is refused, not silently ignored'
);

select throws_ok(
  $$ select public.store_off_product(pg_temp.off_food('50600000000020', 'Portions'), '{"label": "x"}', '{}') $$,
  '22023',
  'store_off_product needs the portions as a JSON array',
  'portions that are not an array are refused'
);

select throws_ok(
  $$ select public.store_off_product(pg_temp.off_food('50600000000020', 'Portions'), null, '{}') $$,
  '22023',
  'store_off_product needs the portions as a JSON array',
  'null portions are refused, since an empty array already means no portions'
);

select throws_ok(
  $$ select public.store_off_product(pg_temp.off_food('50600000000020', 'Raw'), '[]', '"text"') $$,
  '22023',
  'store_off_product needs the raw product as a JSON object',
  'raw data that is not an object is refused'
);

select throws_ok(
  $$ select public.store_off_product(
       pg_temp.off_food('50600000000020', 'Two defaults'),
       '[{"label": "a", "grams": 1, "is_default": true}, {"label": "b", "grams": 2, "is_default": true}]',
       '{}') $$,
  '22023',
  'store_off_product accepts at most one default portion',
  'two default portions are refused with a clear error, not a unique violation'
);

select is(
  (select name from public.foods where source_ref = '50600000000020'),
  'Original name',
  'a refused payload leaves the stored product untouched'
);

select * from finish();

rollback;
