-- Asserts that public.search_foods lists secondary foods last (KEY-761): a name that holds a
-- secondary word (casseroled, curry, takeaway, pie, ...) loses 0.5, unless the search names the
-- dish, and the USDA foods get the same catalogue boost as CoFID.
--
-- `supabase test db` runs this file as postgres inside a transaction that is rolled back. Every
-- fixture id starts with 76100001-. The "glorpken" and "blorvex" cases use made up words, so real
-- foods cannot move them. The plain fixtures lose the tie-break (more commas, a higher id), so only
-- the penalty and the catalogue boost can put them first. The last two cases read the real chicken thigh foods: the USDA ones come from the
-- 20261029010000_usda_foods.sql migration, and CoFID 18-317 is inserted here with
-- `on conflict (source, source_ref) do nothing`, so the cases hold on the CI stack, which loads only
-- the CoFID subset, and on the full import. They look the rows up by source_ref and name.
-- The actor is entered with `set local role` plus the JWT claims that `auth.uid()` reads.

begin;

select plan(14);

insert into auth.users (instance_id, id, aud, role, email) values
  ('00000000-0000-0000-0000-000000000000', '76100001-0000-4000-8000-00000000000a', 'authenticated', 'authenticated', 'search-secondary-last-user@keylow.test');

-- A casseroled CoFID thigh, a plain USDA thigh and a CoFID curry that holds the made up word. The
-- plain thigh has more commas than the casseroled one, so it loses the tie-break: only the penalty on
-- the casseroled row can put the plain thigh first.
insert into public.foods (id, source, source_ref, name, basis) values
  ('76100001-0000-4000-8000-000000000101', 'cofid', 'CF-KEY761-G1', 'Glorpken, thighs, casseroled, meat and skin', 'per_100g'),
  ('76100001-0000-4000-8000-000000000102', 'usda', 'US-KEY761-G2', 'Glorpken, thigh, raw, meat and skin, trimmed, boneless', 'per_100g'),
  ('76100001-0000-4000-8000-000000000103', 'cofid', 'CF-KEY761-G3', 'Glorpken curry, takeaway', 'per_100g');

-- One secondary and one plain food of the same name pattern for each source, so the penalty is read
-- as a score difference per source. The Open Food Facts rows need a fetch time.
insert into public.foods (id, source, source_ref, name, basis) values
  ('76100001-0000-4000-8000-000000000111', 'cofid', 'CF-KEY761-P1', 'Glorpken pie', 'per_100g'),
  ('76100001-0000-4000-8000-000000000112', 'cofid', 'CF-KEY761-P2', 'Glorpken raw', 'per_100g');
insert into public.foods (id, source, source_ref, name, basis, fetched_at) values
  ('76100001-0000-4000-8000-000000000121', 'off', 'OFF-KEY761-P1', 'Glorpken pie', 'per_100g', now()),
  ('76100001-0000-4000-8000-000000000122', 'off', 'OFF-KEY761-P2', 'Glorpken raw', 'per_100g', now());

-- The user's own foods: one that holds a secondary word, one that does not.
insert into public.foods (id, source, source_ref, owner_id, name, basis) values
  ('76100001-0000-4000-8000-000000000201', 'user', null, '76100001-0000-4000-8000-00000000000a', 'Glorpken pie', 'per_100g'),
  ('76100001-0000-4000-8000-000000000202', 'user', null, '76100001-0000-4000-8000-00000000000a', 'Glorpken raw', 'per_100g');

-- Three foods of one name and nothing else to tell them apart. The Open Food Facts row has the lowest
-- id, so it wins every tie, and only a catalogue boost can put the USDA and CoFID rows ahead of it.
insert into public.foods (id, source, source_ref, name, basis, fetched_at) values
  ('76100001-0000-4000-8000-000000000301', 'off', 'OFF-KEY761-B1', 'Blorvex raw', 'per_100g', now());
insert into public.foods (id, source, source_ref, name, basis) values
  ('76100001-0000-4000-8000-000000000302', 'usda', 'US-KEY761-B2', 'Blorvex raw', 'per_100g'),
  ('76100001-0000-4000-8000-000000000303', 'cofid', 'CF-KEY761-B3', 'Blorvex raw', 'per_100g');

-- The casseroled CoFID thighs the QA case compares against. The CoFID subset seed has it already.
insert into public.foods (source, source_ref, name, basis)
values ('cofid', '18-317', 'Chicken, thighs, casseroled, meat and skin', 'per_100g')
on conflict (source, source_ref) do nothing;

set local role authenticated;
set local request.jwt.claims = '{"sub":"76100001-0000-4000-8000-00000000000a","role":"authenticated"}';

select is(
  (select r.id from public.search_foods('glorpken thigh', 50) with ordinality as r
    where r.id in ('76100001-0000-4000-8000-000000000101', '76100001-0000-4000-8000-000000000102')
    order by r.ordinality limit 1),
  '76100001-0000-4000-8000-000000000102'::uuid,
  'for "glorpken thigh" the plain USDA thigh ranks ahead of the casseroled CoFID thighs, though it loses the tie-break'
);

select ok(
  (select plain.score - casseroled.score
    from public.search_foods('glorpken thigh', 50) plain, public.search_foods('glorpken thigh', 50) casseroled
    where plain.id = '76100001-0000-4000-8000-000000000102' and casseroled.id = '76100001-0000-4000-8000-000000000101') > 0,
  'for "glorpken thigh" the plain thigh scores higher than the casseroled one, so the order is not a tie-break'
);

select is(
  (select r.id from public.search_foods('glorpken casserole', 50) with ordinality as r
    where r.id in ('76100001-0000-4000-8000-000000000101', '76100001-0000-4000-8000-000000000102')
    order by r.ordinality limit 1),
  '76100001-0000-4000-8000-000000000101'::uuid,
  'for "glorpken casserole" the casseroled row ranks first, because the search names the dish'
);

select ok(
  (
    select min(r.ordinality) filter (where r.id = '76100001-0000-4000-8000-000000000103')
      < min(r.ordinality) filter (where r.id = '76100001-0000-4000-8000-000000000102')
    from public.search_foods('glorpken curry', 50) with ordinality as r
  ),
  'for "glorpken curry" the curry ranks ahead of the plain thigh'
);

select is(
  (select r.id from public.search_foods('glorpken casser', 50) with ordinality as r
    where r.id in ('76100001-0000-4000-8000-000000000101', '76100001-0000-4000-8000-000000000102')
    order by r.ordinality limit 1),
  '76100001-0000-4000-8000-000000000101'::uuid,
  'a prefix of the secondary word ("casser") waives the penalty, so the casseroled row ranks first'
);

-- Each pair scores alike except for the penalty, so the gap is the penalty.
select is(
  (
    select round((plain.score - pie.score)::numeric, 3)
    from public.search_foods('glorpken', 50) pie, public.search_foods('glorpken', 50) plain
    where pie.id = '76100001-0000-4000-8000-000000000111' and plain.id = '76100001-0000-4000-8000-000000000112'
  ),
  0.5,
  'a CoFID "Glorpken pie" loses secondary_penalty (0.5) against a CoFID "Glorpken raw"'
);

select is(
  (
    select round((plain.score - pie.score)::numeric, 3)
    from public.search_foods('glorpken', 50) pie, public.search_foods('glorpken', 50) plain
    where pie.id = '76100001-0000-4000-8000-000000000121' and plain.id = '76100001-0000-4000-8000-000000000122'
  ),
  0.5,
  'an Open Food Facts "Glorpken pie" loses secondary_penalty (0.5) against an Open Food Facts "Glorpken raw"'
);

select is(
  (
    select round((plain.score - pie.score)::numeric, 3)
    from public.search_foods('glorpken', 50) pie, public.search_foods('glorpken', 50) plain
    where pie.id = '76100001-0000-4000-8000-000000000201' and plain.id = '76100001-0000-4000-8000-000000000202'
  ),
  0.5,
  'the user''s own "Glorpken pie" loses secondary_penalty (0.5) against the own "Glorpken raw"'
);

-- Own food boost 0.3 against catalogue boost 0.1, both rows penalised alike.
select is(
  (
    select round((own.score - catalogue.score)::numeric, 3)
    from public.search_foods('glorpken', 50) own, public.search_foods('glorpken', 50) catalogue
    where own.id = '76100001-0000-4000-8000-000000000201' and catalogue.id = '76100001-0000-4000-8000-000000000111'
  ),
  0.2,
  'the user''s own "Glorpken pie" still gets own_food_boost: 0.2 ahead of the CoFID "Glorpken pie" (0.3 against 0.1)'
);

select is(
  (select array_agg(r.id order by r.ordinality) from public.search_foods('blorvex', 50) with ordinality as r
    where r.id::text like '76100001-%'),
  array[
    '76100001-0000-4000-8000-000000000302',
    '76100001-0000-4000-8000-000000000303',
    '76100001-0000-4000-8000-000000000301'
  ]::uuid[],
  'the USDA and CoFID rows rank ahead of the identical Open Food Facts row, which wins every tie-break, by catalogue_boost'
);

select is(
  (
    select round((usda.score - off.score)::numeric, 3)
    from public.search_foods('blorvex', 50) usda, public.search_foods('blorvex', 50) off
    where usda.id = '76100001-0000-4000-8000-000000000302' and off.id = '76100001-0000-4000-8000-000000000301'
  ),
  0.1,
  'the USDA row scores 0.1 (catalogue_boost) above the identical Open Food Facts row'
);

select ok(
  (
    select first_thigh.source = 'usda'
    from (
      select r.source, r.name
      from public.search_foods('chicken thigh', 50) with ordinality as r
      where r.name ilike 'Chicken, thigh%'
      order by r.ordinality
      limit 1
    ) as first_thigh
  ),
  'the first "Chicken, thigh..." result for "chicken thigh" is a usda food'
);

select ok(
  (
    select max(r.ordinality) filter (where r.source = 'usda' and (r.name ilike 'Chicken, thigh, raw%' or r.name ilike 'Chicken, thigh, roasted%'))
      < min(r.ordinality) filter (where r.source = 'cofid' and r.name = 'Chicken, thighs, casseroled, meat and skin')
    from public.search_foods('chicken thigh', 50) with ordinality as r
  ),
  'every usda raw or roasted chicken thigh ranks ahead of the casseroled CoFID thighs (18-317) for "chicken thigh"'
);

select is(
  (select count(*)::int from public.search_foods('chicken thigh', 50) r
    where r.name = 'Chicken, thighs, casseroled, meat and skin' and r.source = 'cofid'),
  1,
  'the casseroled CoFID thighs are still found for "chicken thigh", only lower down'
);

reset role;

select * from finish();

rollback;
