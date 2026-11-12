-- Asserts that public.search_foods finds a food under another spelling (KEY-879): "yoghurt" finds
-- Yogurt, "eggplant" finds Aubergine and "chickpea" finds chick peas, through the `aliases` list.
--
-- `supabase test db` runs this file as postgres inside a transaction that is rolled back. Every
-- fixture id starts with 87900001-. The "glorpken" cases use made up foods, so real foods cannot move
-- them. The table of searches reads the first row for each search, on the real CoFID foods. The CI seed
-- loads only a CoFID subset, so the real foods it lacks are inserted below by their real codes with
-- `on conflict (source, source_ref) do nothing`: the full import has them already, so every case holds
-- on both seeds. The last cases run every alias word as the last word and as an earlier word of a
-- search: a second alias row for one word makes that search fail with "more than one row returned by a
-- subquery", and a two word alias breaks the tsquery unless the space becomes the phrase operator.
-- The actor is entered with `set local role` plus the JWT claims that `auth.uid()` reads.

begin;

select plan(134);

insert into auth.users (instance_id, id, aud, role, email) values
  ('00000000-0000-0000-0000-000000000000', '87900001-0000-4000-8000-00000000000a', 'authenticated', 'authenticated', 'search-other-spellings-user@keylow.test'),
  ('00000000-0000-0000-0000-000000000000', '87900001-0000-4000-8000-00000000000b', 'authenticated', 'authenticated', 'search-other-spellings-other@keylow.test');

-- Real CoFID foods that the CI subset seed lacks. The full import has them.
insert into public.foods (source, source_ref, name, basis) values
  ('cofid', '13-161', 'Aubergine, raw', 'per_100g'),
  ('cofid', '13-873', 'Chilli powder', 'per_100g'),
  ('cofid', '13-888', 'Coriander leaves, fresh', 'per_100g'),
  ('cofid', '13-484', 'Dahl, mixed, homemade', 'per_100g'),
  ('cofid', '11-850', 'Doughnuts, ring, iced', 'per_100g'),
  ('cofid', '13-516', 'Pak choi, steamed', 'per_100g'),
  ('cofid', '13-522', 'Rocket, raw', 'per_100g'),
  ('cofid', '17-721', 'Soy sauce, light and dark varieties', 'per_100g')
on conflict (source, source_ref) do nothing;

-- The other sources and the other direction, with made up foods. The Open Food Facts row needs a fetch
-- time. The last food belongs to another person, so the actor must not get it back.
insert into public.foods (id, source, source_ref, name, basis, fetched_at) values
  ('87900001-0000-4000-8000-000000000101', 'off', 'OFF-KEY879-G1', 'Glorpken yoghurt', 'per_100g', now());
insert into public.foods (id, source, source_ref, owner_id, name, basis) values
  ('87900001-0000-4000-8000-000000000201', 'user', null, '87900001-0000-4000-8000-00000000000a', 'Glorpken hummus', 'per_100g'),
  ('87900001-0000-4000-8000-000000000301', 'user', null, '87900001-0000-4000-8000-00000000000b', 'Glorpken yoghurt', 'per_100g');

set local role authenticated;
set local request.jwt.claims = '{"sub":"87900001-0000-4000-8000-00000000000a","role":"authenticated"}';

-- The first row of each search must have a name that matches the pattern. (?i) makes a pattern case blind.
select matches(
  (select r.name from public.search_foods(searches.search, 10) with ordinality as r order by r.ordinality limit 1),
  searches.pattern,
  '"' || searches.search || '" lists a food matching ' || searches.pattern || ' first'
)
from (values
  ('yoghurt', '^Yogurt, '),
  ('yoghurts', '^Yogurt, '),
  ('yogurt', '^Yogurt, '),
  ('yogurts', '^Yogurt, '),
  ('natural yoghurt', '^Yogurt, .*plain'),
  ('natural yogurt', '^Yogurt, .*plain'),
  ('greek yoghurt', '^Yogurt, Greek style'),
  ('greek yogurt', '^Yogurt, Greek style'),
  ('hummus', '^Houmous$'),
  ('humous', '^Houmous$'),
  ('houmous', '^Houmous$'),
  ('chili', '(?i)chilli'),
  ('chilli', '(?i)chilli'),
  ('chillies', '(?i)chilli'),
  ('chilies', '(?i)chilli'),
  ('chili powder', '^Chilli powder$'),
  ('chilli powder', '^Chilli powder$'),
  ('eggplant', '^Aubergine'),
  ('eggplants', '^Aubergine'),
  ('aubergine', '^Aubergine'),
  ('zucchini', '^Courgette'),
  ('zucchinis', '^Courgette'),
  ('courgette', '^Courgette'),
  ('cilantro', '^Coriander'),
  ('coriander', '^Coriander'),
  ('arugula', '^Rocket'),
  ('rocket', '^Rocket'),
  ('scallion', '^Spring onions'),
  ('scallions', '^Spring onions'),
  ('spring onion', '^Spring onions'),
  ('chickpea', '(?i)chick pea'),
  ('chickpeas', '(?i)chick pea'),
  ('chick pea', '(?i)chick pea'),
  ('garbanzo beans', '^Beans, chick peas'),
  ('chickpea curry', '^Curry, chick pea'),
  ('oatmeal', '^Porridge'),
  ('porridge', '^Porridge'),
  ('ground beef', '^Beef, mince'),
  ('beef mince', '^Beef, mince'),
  ('bell pepper', '^Peppers?, capsicum'),
  ('bell peppers', '^Peppers?, capsicum'),
  ('bok choy', '^Pak choi'),
  ('pak choy', '^Pak choi'),
  ('pak choi', '^Pak choi'),
  ('donut', '^Doughnuts'),
  ('donuts', '^Doughnuts'),
  ('doughnut', '^Doughnuts'),
  ('doughnuts', '^Doughnuts'),
  ('dhal', '(?i)dahl'),
  ('dahl', '(?i)dahl'),
  ('soya sauce', '^Soy sauce'),
  ('soy sauce', '^Soy sauce'),
  ('tomato paste', '^Tomato puree$'),
  ('tomato puree', '^Tomato puree$')
) as searches (search, pattern);

-- "dal" ties Dal Dhokari with Dahl, mixed, homemade, so Dahl is among the first 5 rather than first.
select ok(
  exists (select 1 from public.search_foods('dal', 5) as r where r.name ~ '^Dahl, mixed'),
  '"dal" lists Dahl, mixed, homemade among the first 5 rows'
);

select ok(
  exists (select 1 from public.search_foods('glorpken yogurt', 50) as r where r.id = '87900001-0000-4000-8000-000000000101'),
  'an Open Food Facts "Glorpken yoghurt" is found by "glorpken yogurt"'
);

select ok(
  exists (select 1 from public.search_foods('glorpken houmous', 50) as r where r.id = '87900001-0000-4000-8000-000000000201'),
  'the person''s own "Glorpken hummus" is found by "glorpken houmous"'
);

select ok(
  not exists (select 1 from public.search_foods('glorpken yogurt', 50) as r where r.id = '87900001-0000-4000-8000-000000000301'),
  'another person''s own "Glorpken yoghurt" is not returned'
);

-- The words that already worked keep their scores.
select is(
  (select round(r.score::numeric, 3) from public.search_foods('yogurt', 50) as r where r.name = 'Yogurt, low fat, plain'),
  2.157,
  '"yogurt" still scores Yogurt, low fat, plain at 2.157'
);

select is(
  (select round(r.score::numeric, 3) from public.search_foods('chilli', 50) as r where r.name = 'Chilli powder'),
  2.157,
  '"chilli" still scores Chilli powder at 2.157'
);

-- Every alias word, as the last word and as an earlier word. Keep this list in step with `aliases`.
select lives_ok(
  format('select * from public.search_foods(%L, 5)', alias_words.word || tails.tail),
  '"' || alias_words.word || tails.tail || '" searches without an error'
)
from (values ('yoghurt'), ('yoghurts'), ('yogurt'), ('yogurts'), ('hummus'), ('humous'), ('houmous'), ('chili'), ('chilies'), ('chilli'), ('chillies'), ('donut'), ('donuts'), ('doughnut'), ('doughnuts'), ('dal'), ('dhal'), ('soya'), ('eggplant'), ('eggplants'), ('zucchini'), ('zucchinis'), ('cilantro'), ('arugula'), ('oatmeal'), ('bok'), ('choy'), ('bell'), ('ground'), ('paste'), ('natural'), ('scallion'), ('scallions'), ('chickpea'), ('chickpeas'), ('garbanzo'), ('corn')) as alias_words (word)
cross join (values (''), (' onion')) as tails (tail);

reset role;

select * from finish();

rollback;
