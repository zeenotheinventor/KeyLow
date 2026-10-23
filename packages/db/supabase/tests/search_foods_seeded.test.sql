-- Asserts the seeded search acceptance of M2: against the committed seed data, search_foods answers
-- "chicken breast" with a CoFID food first and finds chicken for the half typed word "chick".
--
-- It needs seeds/10_cofid_subset.sql and seeds/20_off_sample.sql loaded. A fresh stack (supabase start,
-- supabase db reset, and every CI run) loads them. A running database takes them with the psql command
-- in docs/runbooks/local-dev.md. The first two assertions fail with that instruction if they are missing.
-- The test also passes on a database that holds the full CoFID import, which contains the subset, so
-- every assertion reads the seeded foods by code or looks only at the top of one search.
--
-- The seeded codes below are the codes in data/cofid/subset.txt, which
-- test/unit/seeds/cofidSubsetSeed.test.ts keeps in step with this list.
--
-- Ranking (KEY-64). "chick" is a half typed word, so it matches "chicken" and "chick peas" alike and
-- the simpler name wins the tie: a chicken food is in the top 3 and ahead of every chick pea food.
-- The assertions read the top of one search, so they hold on the subset and on the full import.
-- "stew", "tart" and "onion" check the first word bonus (a food that begins with the typed word comes
-- before one that has it deeper in its name). The subset has no Stew or Tart food, so those two
-- assertions pass trivially there and are real on the full import; "onion" is real on both.
--
-- `supabase test db` runs this file as postgres inside a transaction that is rolled back, so nothing
-- created here persists. The actor is entered with `set local role` plus the JWT claims that
-- `auth.uid()` reads, and left with `reset role`.

begin;

select plan(13);

create temporary table seeded_cofid_codes (code text primary key) on commit drop;
insert into seeded_cofid_codes (code) values
  ('11-450'), ('11-716'), ('11-718'), ('11-722'), ('11-723'), ('11-742'), ('11-788'), ('11-789'),
  ('11-823'), ('11-857'), ('11-858'), ('11-861'), ('11-862'), ('11-866'), ('11-867'), ('11-868'),
  ('11-869'), ('11-874'), ('11-875'), ('11-886'), ('11-889'), ('11-923'), ('11-947'), ('11-968'),
  ('11-969'), ('11-971'), ('11-972'), ('11-973'), ('11-974'), ('11-980'), ('11-981'), ('11-982'),
  ('11-1001'), ('11-1029'), ('11-1106'), ('11-1107'), ('11-1108'), ('11-1129'), ('11-1145'), ('12-184'),
  ('12-307'), ('12-313'), ('12-320'), ('12-328'), ('12-332'), ('12-334'), ('12-344'), ('12-345'),
  ('12-346'), ('12-348'), ('12-355'), ('12-358'), ('12-360'), ('12-367'), ('12-375'), ('12-377'),
  ('12-379'), ('12-485'), ('12-491'), ('12-493'), ('12-496'), ('12-512'), ('12-522'), ('12-523'),
  ('12-524'), ('12-525'), ('12-526'), ('12-527'), ('12-533'), ('12-535'), ('12-539'), ('12-550'),
  ('12-554'), ('12-555'), ('12-596'), ('12-937'), ('12-938'), ('12-939'), ('12-940'), ('12-943'),
  ('12-944'), ('12-945'), ('12-963'), ('13-025'), ('13-074'), ('13-076'), ('13-077'), ('13-089'),
  ('13-109'), ('13-157'), ('13-177'), ('13-190'), ('13-244'), ('13-316'), ('13-317'), ('13-318'),
  ('13-352'), ('13-448'), ('13-463'), ('13-485'), ('13-487'), ('13-489'), ('13-490'), ('13-491'),
  ('13-492'), ('13-495'), ('13-496'), ('13-497'), ('13-499'), ('13-500'), ('13-502'), ('13-503'),
  ('13-505'), ('13-512'), ('13-517'), ('13-519'), ('13-521'), ('13-523'), ('13-524'), ('13-530'),
  ('13-531'), ('13-553'), ('13-556'), ('13-570'), ('13-572'), ('13-573'), ('13-582'), ('13-618'),
  ('13-620'), ('13-622'), ('13-624'), ('13-627'), ('13-630'), ('13-631'), ('13-634'), ('13-636'),
  ('13-646'), ('13-656'), ('13-657'), ('13-658'), ('13-659'), ('13-660'), ('13-661'), ('13-662'),
  ('13-670'), ('13-671'), ('13-879'), ('14-025'), ('14-091'), ('14-125'), ('14-129'), ('14-131'),
  ('14-142'), ('14-178'), ('14-299'), ('14-318'), ('14-319'), ('14-320'), ('14-321'), ('14-324'),
  ('14-326'), ('14-327'), ('14-329'), ('14-331'), ('14-339'), ('14-342'), ('14-346'), ('14-347'),
  ('14-369'), ('14-371'), ('14-372'), ('14-376'), ('14-378'), ('14-380'), ('14-382'), ('14-384'),
  ('14-386'), ('14-391'), ('14-392'), ('14-394'), ('14-395'), ('14-870'), ('14-892'), ('15-107'),
  ('15-641'), ('15-744'), ('15-748'), ('15-795'), ('15-865'), ('16-356'), ('16-357'), ('16-360'),
  ('16-372'), ('16-373'), ('16-399'), ('16-412'), ('16-416'), ('16-417'), ('17-031'), ('17-038'),
  ('17-041'), ('17-045'), ('17-073'), ('17-078'), ('17-091'), ('17-212'), ('17-222'), ('17-247'),
  ('17-655'), ('17-661'), ('17-685'), ('17-686'), ('17-727'), ('17-749'), ('17-752'), ('17-755'),
  ('17-767'), ('17-821'), ('18-289'), ('18-290'), ('18-297'), ('18-307'), ('18-308'), ('18-309'),
  ('18-317'), ('18-323'), ('18-324'), ('18-325'), ('18-326'), ('18-329'), ('18-330'), ('18-331'),
  ('18-334'), ('18-337'), ('18-341'), ('18-350'), ('18-356'), ('18-411'), ('18-469'), ('18-470'),
  ('18-488'), ('18-500'), ('18-504'), ('18-507'), ('18-508'), ('18-518'), ('18-521'), ('18-524'),
  ('19-016'), ('19-497'), ('19-500'), ('19-509'), ('19-510');

create temporary table seeded_off_barcodes (barcode text primary key) on commit drop;
insert into seeded_off_barcodes (barcode) values
  ('2000000000015'), ('2000000000022'), ('2000000000039'), ('2000000000046'), ('2000000000053');

select is(
  (
    select count(*)::integer
    from public.foods f
    join seeded_cofid_codes c on c.code = f.source_ref
    where f.source = 'cofid'
  ),
  (select count(*)::integer from seeded_cofid_codes),
  'the CoFID subset is present, if this fails load the seeds as docs/runbooks/local-dev.md says (psql with seeds/10_cofid_subset.sql)'
);

select is(
  (
    select count(*)::integer
    from public.foods f
    join seeded_off_barcodes b on b.barcode = f.source_ref
    where f.source = 'off' and f.barcode = f.source_ref
  ),
  (select count(*)::integer from seeded_off_barcodes),
  'the Open Food Facts samples are present, if this fails load the seeds as docs/runbooks/local-dev.md says (psql with seeds/20_off_sample.sql)'
);

-- A user who has just signed up and owns no foods.
insert into auth.users (instance_id, id, aud, role, email) values
  ('00000000-0000-0000-0000-000000000000', '48000001-0000-4000-8000-00000000000a', 'authenticated', 'authenticated', 'seeded-search-user@keylow.test');

set local role authenticated;
set local request.jwt.claims = '{"sub":"48000001-0000-4000-8000-00000000000a","role":"authenticated"}';

select is(
  (
    select result.source::text
    from public.search_foods('chicken breast', 25) with ordinality as result
    order by result.ordinality
    limit 1
  ),
  'cofid',
  'the first result for "chicken breast" is a CoFID food'
);

select imatches(
  (
    select result.name
    from public.search_foods('chicken breast', 25) with ordinality as result
    order by result.ordinality
    limit 1
  ),
  'chicken.*breast',
  'the first result for "chicken breast" is a chicken breast food'
);

select ok(
  exists (
    select 1
    from public.search_foods('chick', 25) as result
    where result.source = 'cofid' and result.name ilike 'chicken%'
  ),
  'the half typed word "chick" returns at least one chicken food within the default 25 results'
);

select ok(
  exists (
    select 1
    from public.search_foods('kilojoule bar', 10) as result
    where result.source = 'off'
      and result.id = (select f.id from public.foods f where f.source = 'off' and f.source_ref = '2000000000039')
  ),
  'a seeded Open Food Facts sample is found by its name'
);

select ok(
  exists (
    select 1
    from public.search_foods('chick', 25) with ordinality as result
    where result.ordinality <= 3 and result.name ilike 'chicken%'
  ),
  'the half typed word "chick" has a food named Chicken in its top 3'
);

select ok(
  (
    select min(result.ordinality) filter (where result.name ilike 'chicken%')
      < coalesce(min(result.ordinality) filter (where result.name ilike '%chick peas%'), 1000)
    from public.search_foods('chick', 25) with ordinality as result
  ),
  '"chick" puts a food named Chicken ahead of the chick peas'
);

select is(
  (
    select result.comma_count
    from (
      select
        pg_catalog.char_length(r.name) - pg_catalog.char_length(replace(r.name, ',', '')) as comma_count,
        r.ordinality,
        r.score
      from public.search_foods('chicken breast', 25) with ordinality as r
    ) result
    order by result.ordinality
    limit 1
  ),
  (
    select min(
      pg_catalog.char_length(r.name) - pg_catalog.char_length(replace(r.name, ',', ''))
    )
    from public.search_foods('chicken breast', 25) r
    where r.score = (select max(top.score) from public.search_foods('chicken breast', 25) top)
  ),
  'among the foods tied for the best score for "chicken breast", the first has the fewest commas'
);

select ok(
  (
    select result.name ilike 'onion%'
    from public.search_foods('onion', 25) with ordinality as result
    order by result.ordinality
    limit 1
  ),
  'the first result for "onion" is a food that begins with onion, not one that has it deeper in its name'
);

select ok(
  not exists (select 1 from public.foods where source = 'cofid' and name ilike 'tart,%')
    or (
      select result.name ilike 'tart%'
      from public.search_foods('tart', 25) with ordinality as result
      order by result.ordinality
      limit 1
    ),
  'if the catalogue has a Tart food, the first result for "tart" begins with tart'
);

select ok(
  not exists (select 1 from public.foods where source = 'cofid' and name ilike 'stew,%')
    or exists (
      select 1
      from public.search_foods('stew', 25) with ordinality as result
      where result.ordinality <= 10 and result.name ilike 'stew,%'
    ),
  'if the catalogue has a Stew food, it is in the top 10 for "stew"'
);

select ok(
  (
    select count(*) filter (where result.name ilike 'chicken%')
    from public.search_foods('chick', 5) as result
  ) = 5,
  'the top 5 for "chick" are all foods named Chicken'
);

reset role;

select * from finish();

rollback;
