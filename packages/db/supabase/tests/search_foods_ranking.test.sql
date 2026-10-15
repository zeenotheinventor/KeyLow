-- Asserts how public.search_foods ranks (KEY-64): the word being typed matches by prefix only, with
-- no bonus for being a whole word, and equal scores fall back to the simpler name.
--
-- `supabase test db` runs this file as postgres inside a transaction that is rolled back. Every
-- fixture id starts with 64000001- and every name carries the made up word "Plonkzed" (or its
-- whole word stem "Plonk"), and every query is for that word, so real foods cannot change a result.
-- The actor is entered with `set local role` plus the JWT claims that `auth.uid()` reads.

begin;

select plan(11);

insert into auth.users (instance_id, id, aud, role, email) values
  ('00000000-0000-0000-0000-000000000000', '64000001-0000-4000-8000-00000000000a', 'authenticated', 'authenticated', 'search-ranking-user@keylow.test');

-- All CoFID rows, so no boost separates them. The first group is the "chick" against "chicken" case
-- (a whole word "plonk" against the longer word "plonkzed", both deeper in the name). The second group
-- differs only in the things the tie-break reads: commas, length, name and id, and all begin with
-- "Plonkzed" so they share the first word bonus. The last group is the first word bonus itself.
insert into public.foods (id, source, source_ref, name, basis) values
  ('64000001-0000-4000-8000-000000000101', 'cofid', 'CF-KEY64-1', 'Beans, plonk, raw', 'per_100g'),
  ('64000001-0000-4000-8000-000000000102', 'cofid', 'CF-KEY64-2', 'Plonkzed, roasted', 'per_100g'),
  ('64000001-0000-4000-8000-000000000103', 'cofid', 'CF-KEY64-9', 'Beans, plonkzed, raw', 'per_100g'),
  ('64000001-0000-4000-8000-000000000201', 'cofid', 'CF-KEY64-3', 'Plonkzed, raw, aged', 'per_100g'),
  ('64000001-0000-4000-8000-000000000202', 'cofid', 'CF-KEY64-4', 'Plonkzed, raw', 'per_100g'),
  ('64000001-0000-4000-8000-000000000203', 'cofid', 'CF-KEY64-5', 'Plonkzed pie recipe', 'per_100g'),
  ('64000001-0000-4000-8000-000000000204', 'cofid', 'CF-KEY64-6', 'Plonkzed pie', 'per_100g'),
  ('64000001-0000-4000-8000-000000000205', 'cofid', 'CF-KEY64-7', 'Plonkzed pia', 'per_100g'),
  ('64000001-0000-4000-8000-000000000206', 'cofid', 'CF-KEY64-8', 'Plonkzed pie', 'per_100g'),
  -- "zibble": the first word is the typed word (A), its plural (C), longer than it (D), or the word is
  -- deeper in the name (B as a longer word, E as the word itself). Without the bonus, B and E would win
  -- on fewer commas.
  ('64000001-0000-4000-8000-000000000301', 'cofid', 'CF-KEY64-Z1', 'Zibble, beef, homemade', 'per_100g'),
  ('64000001-0000-4000-8000-000000000302', 'cofid', 'CF-KEY64-Z2', 'Damsons, zibbled', 'per_100g'),
  ('64000001-0000-4000-8000-000000000303', 'cofid', 'CF-KEY64-Z3', 'Zibbles, jam, homemade', 'per_100g'),
  ('64000001-0000-4000-8000-000000000304', 'cofid', 'CF-KEY64-Z4', 'Zibbleton pie, large, homemade', 'per_100g'),
  ('64000001-0000-4000-8000-000000000305', 'cofid', 'CF-KEY64-Z5', 'Sweet potato and zibble layer', 'per_100g');

set local role authenticated;
set local request.jwt.claims = '{"sub":"64000001-0000-4000-8000-00000000000a","role":"authenticated"}';

select is(
  (select r.score from public.search_foods('plonk', 50) r where r.id = '64000001-0000-4000-8000-000000000101'),
  (select r.score from public.search_foods('plonk', 50) r where r.id = '64000001-0000-4000-8000-000000000103'),
  'deep in the name, the whole word "plonk" scores the same as the longer word "plonkzed" for the half typed "plonk"'
);

select ok(
  (
    select min(r.ordinality) filter (where r.id = '64000001-0000-4000-8000-000000000102')
      < min(r.ordinality) filter (where r.id = '64000001-0000-4000-8000-000000000101')
    from public.search_foods('plonk', 50) with ordinality as r
    where r.id::text like '64000001-%'
  ),
  'a name that begins with the longer word ranks ahead of the whole word deeper in a name, as chicken does ahead of chick peas'
);

select is(
  (
    select array_agg(r.id order by r.ordinality)
    from public.search_foods('plonkz', 50) with ordinality as r
    where r.id::text like '64000001-%'
      and r.id not in ('64000001-0000-4000-8000-000000000101', '64000001-0000-4000-8000-000000000103')
  ),
  array[
    '64000001-0000-4000-8000-000000000205',
    '64000001-0000-4000-8000-000000000204',
    '64000001-0000-4000-8000-000000000206',
    '64000001-0000-4000-8000-000000000203',
    '64000001-0000-4000-8000-000000000202',
    '64000001-0000-4000-8000-000000000102',
    '64000001-0000-4000-8000-000000000201'
  ]::uuid[],
  'equal scores fall back to fewer commas, then shorter, then name, then id'
);

select is(
  (
    select count(distinct r.score)::int
    from public.search_foods('plonkz', 50) r
    where r.id::text like '64000001-%'
      and r.id not in ('64000001-0000-4000-8000-000000000101', '64000001-0000-4000-8000-000000000103')
  ),
  1,
  'the fixtures for the tie-break really are tied on score, so only the tie-break orders them'
);

select ok(
  (
    select r.score from public.search_foods('plonkzed', 50) r where r.id = '64000001-0000-4000-8000-000000000204'
  ) = (
    select r.score from public.search_foods('plonkzed', 50) r where r.id = '64000001-0000-4000-8000-000000000201'
  ),
  'a finished word matches by prefix too: one more letter changes no score between the fixtures'
);

select ok(
  (
    select min(r.ordinality) filter (where r.id = '64000001-0000-4000-8000-000000000204')
      < min(r.ordinality) filter (where r.id = '64000001-0000-4000-8000-000000000202')
    from public.search_foods('plonkzed', 50) with ordinality as r
  ),
  'ties are the same for a finished word: the name without commas is first'
);

select ok(
  (select r.score from public.search_foods('plonkzed pie', 50) r where r.id = '64000001-0000-4000-8000-000000000204')
    > (select r.score from public.search_foods('plonkzed pie', 50) r where r.id = '64000001-0000-4000-8000-000000000201'),
  'a food matching every word beats one matching only the first'
);

select is(
  (select count(*)::int from public.search_foods('plonkzed pie', 50) r where r.id = '64000001-0000-4000-8000-000000000204'),
  1,
  'the same food appears once however many arms match it'
);

select is(
  (
    select array_agg(r.id order by r.ordinality)
    from public.search_foods('zibble', 50) with ordinality as r
    where r.id::text like '64000001-%0000000003__'
  ),
  array[
    '64000001-0000-4000-8000-000000000301',
    '64000001-0000-4000-8000-000000000303',
    '64000001-0000-4000-8000-000000000304',
    '64000001-0000-4000-8000-000000000305',
    '64000001-0000-4000-8000-000000000302'
  ]::uuid[],
  'a first word equal to the typed word beats its plural, which beats a longer first word, which beats the word deeper in the name'
);

select ok(
  (select r.score from public.search_foods('zibble', 50) r where r.id = '64000001-0000-4000-8000-000000000301')
    > (select r.score from public.search_foods('zibble', 50) r where r.id = '64000001-0000-4000-8000-000000000303')
  and (select r.score from public.search_foods('zibble', 50) r where r.id = '64000001-0000-4000-8000-000000000303')
    > (select r.score from public.search_foods('zibble', 50) r where r.id = '64000001-0000-4000-8000-000000000304')
  and (select r.score from public.search_foods('zibble', 50) r where r.id = '64000001-0000-4000-8000-000000000304')
    > (select r.score from public.search_foods('zibble', 50) r where r.id = '64000001-0000-4000-8000-000000000305'),
  'the first word bonuses are strictly higher scores, not ties broken by commas'
);

select is(
  (select r.score from public.search_foods('zibble', 50) r where r.id = '64000001-0000-4000-8000-000000000305'),
  (select r.score from public.search_foods('zibble', 50) r where r.id = '64000001-0000-4000-8000-000000000302'),
  'a match deeper in the name earns no first word bonus, whether the word is whole or a longer word'
);

reset role;

select * from finish();

rollback;
