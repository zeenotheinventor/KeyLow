-- Asserts that public.search_foods lists plain foods first (KEY-754): a name that matches the typed
-- word twice scores no more than one that matches it once, and "corn" also finds sweetcorn.
--
-- `supabase test db` runs this file as postgres inside a transaction that is rolled back. Every
-- fixture id starts with 74800001-. The "glorp" case uses a made up word, so real foods cannot change
-- it. The "peas" and "corn" cases insert the foods they need and read only the top of one search, so
-- they hold on the CoFID subset seed (which has no "Peas, ..." foods, only chick peas, but does have
-- Sweetcorn, kernels, raw and Sweetcorn, baby, boiled) and on the full CoFID import.
-- The second "peas" assertion only checks the first 5 CoFID rows when the catalogue holds at least 5
-- real "Peas, ..." foods: it is real on the full import and passes on the subset.
-- The "onion" case needs the foods of seeds/10_cofid_subset.sql, which the full import contains.
-- The actor is entered with `set local role` plus the JWT claims that `auth.uid()` reads.

begin;

select plan(9);

insert into auth.users (instance_id, id, aud, role, email) values
  ('00000000-0000-0000-0000-000000000000', '74800001-0000-4000-8000-00000000000a', 'authenticated', 'authenticated', 'search-plain-first-user@keylow.test');

-- Both CoFID, so no boost separates them. The curry matches "glorp" twice ("glorp" and the prefix of
-- "glorpnuts"), the plain food once.
insert into public.foods (id, source, source_ref, name, basis) values
  ('74800001-0000-4000-8000-000000000101', 'cofid', 'CF-KEY754-G1', 'Glorp, raw', 'per_100g'),
  ('74800001-0000-4000-8000-000000000102', 'cofid', 'CF-KEY754-G2', 'Curry, glorp dahl with glorpnuts, homemade', 'per_100g'),
  ('74800001-0000-4000-8000-000000000201', 'cofid', 'CF-KEY754-P1', 'Peas, raw', 'per_100g'),
  ('74800001-0000-4000-8000-000000000202', 'cofid', 'CF-KEY754-P2', 'Curry, pigeon pea dahl with tomatoes and peanuts, homemade', 'per_100g'),
  ('74800001-0000-4000-8000-000000000301', 'cofid', 'CF-KEY754-C1', 'Chicken, corn-fed, raw, meat only', 'per_100g'),
  -- The subset has only two Sweetcorn foods, so these three fill the rest of the first 5 for "corn" and
  -- the corn-fed chicken (which scores lower) has to be outside them. On the full import they repeat
  -- foods that exist.
  ('74800001-0000-4000-8000-000000000302', 'cofid', 'CF-KEY754-C2', 'Corn snacks', 'per_100g'),
  ('74800001-0000-4000-8000-000000000303', 'cofid', 'CF-KEY754-C3', 'Corn pudding, homemade', 'per_100g'),
  ('74800001-0000-4000-8000-000000000304', 'cofid', 'CF-KEY754-C4', 'Sweetcorn, dried', 'per_100g');

set local role authenticated;
set local request.jwt.claims = '{"sub":"74800001-0000-4000-8000-00000000000a","role":"authenticated"}';

select ok(
  (
    select min(r.ordinality) filter (where r.id = '74800001-0000-4000-8000-000000000101')
      < min(r.ordinality) filter (where r.id = '74800001-0000-4000-8000-000000000102')
    from public.search_foods('glorp', 50) with ordinality as r
  ),
  'a name that begins with the typed word ranks ahead of a name that matches it twice deeper in the name'
);

select ok(
  (select r.score from public.search_foods('glorp', 50) r where r.id = '74800001-0000-4000-8000-000000000102')
    <= (select r.score from public.search_foods('glorp', 50) r where r.id = '74800001-0000-4000-8000-000000000101'),
  'matching the typed word twice scores no more than matching it once'
);

select imatches(
  (
    select r.name
    from public.search_foods('peas', 25) with ordinality as r
    where r.source = 'cofid'
    order by r.ordinality
    limit 1
  ),
  '^Peas, ',
  'the first Common result for "peas" is a plain Peas food, not a dish that mentions pea and peanut'
);

select ok(
  (select count(*) from public.foods where source = 'cofid' and deleted_at is null and name ilike 'peas, %' and id::text not like '74800001-%') < 5
    or (
      select count(*) filter (where top.name ilike 'peas, %') = 5
      from (
        select r.name
        from public.search_foods('peas', 25) with ordinality as r
        where r.source = 'cofid'
        order by r.ordinality
        limit 5
      ) as top
    ),
  'when the catalogue has 5 Peas foods (the full import), the first 5 Common results for "peas" are all Peas foods'
);

select ok(
  exists (
    select 1
    from (
      select r.name
      from public.search_foods('corn', 25) with ordinality as r
      where r.source = 'cofid'
      order by r.ordinality
      limit 5
    ) as top
    where top.name ilike 'sweetcorn%'
  ),
  'a Sweetcorn food is among the first 5 Common results for "corn"'
);

select ok(
  not exists (
    select 1
    from (
      select r.name
      from public.search_foods('corn', 25) with ordinality as r
      where r.source = 'cofid'
      order by r.ordinality
      limit 5
    ) as top
    where top.name ilike 'chicken, corn-fed%'
  ),
  'no corn-fed chicken is among the first 5 Common results for "corn"'
);

select imatches(
  (
    select r.name
    from public.search_foods('sweetcorn', 25) with ordinality as r
    where r.source = 'cofid'
    order by r.ordinality
    limit 1
  ),
  '^Sweetcorn',
  'the alias does not get in the way of the word itself: "sweetcorn" still finds sweetcorn first'
);

select is(
  (
    select array_agg(f.source_ref order by r.ordinality)
    from public.search_foods('onion', 50) with ordinality as r
    join public.foods f on f.id = r.id
    where f.source = 'cofid' and f.source_ref in ('13-499', '13-500', '13-352')
  ),
  array['13-499', '13-500', '13-352'],
  'a query with no alias, "onion", keeps its order for the seeded onion foods'
);

select is(
  (
    select count(*)::int
    from public.search_foods('corn', 50) r
    where r.id = '74800001-0000-4000-8000-000000000301'
  ),
  1,
  'the corn-fed chicken fixture is still found for "corn", only lower down'
);

reset role;

select * from finish();

rollback;
