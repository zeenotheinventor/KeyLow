-- Food search, secondary foods last (KEY-761):
--   1. a food whose name holds a "secondary" word (casseroled, stewed, curry, sauce, pie, ...) loses
--      `secondary_penalty`, so plain raw, roasted, grilled, boiled or fried foods rank ahead of
--      casseroled and stewed pieces and prepared dishes, from any source.
--   2. a search that names the dish keeps it first: "chicken casserole" lists the casseroled chicken
--      first and "chicken curry" the curries.
--   3. `cofid_boost` becomes `catalogue_boost` and covers the USDA foods too, so a USDA thigh does not
--      start 0.1 behind every CoFID row.
-- Replaces public.search_foods from 20261028230000_search_foods_plain_first.sql and changes nothing
-- else: same signature, return type and grants (create or replace keeps them),
-- search_food_candidate_ids unchanged, ties and the rest of the order as they were.
--
-- 1. The `secondary_words` CTE is a values list like `aliases`. A food loses `secondary_penalty` (0.5,
-- more than any gap between a plain thigh and the casserole before this change) when its name holds
-- one of the words as a whole word, case blind (`\m...\M`). It is taken once, however many secondary
-- words the name holds. It reads only `name`, so it covers CoFID, USDA, Open Food Facts and the user's
-- own foods, and needs no column or backfill. "casserole" is in the list as well as "casseroled", and
-- "stew" as well as "stewed", because CoFID has both "Chicken, thighs, casseroled" and "Casserole,
-- vegetable, homemade", and both "Apricots, stewed with sugar" and "Stew, beef, homemade".
-- The list holds words that say what a food is: a moist cooking method or a dish. It leaves out
-- descriptors that say where a food came from or how it is finished (homemade, retail, reheated,
-- takeaway, coated). Those do not make a food secondary, and whole dish families are named with them
-- ("Dahl, mixed, homemade", "Risotto, plain, homemade", "Mayonnaise, homemade"), so demoting them
-- would push the dish the user asked for behind unrelated raw foods.
-- To add a word, add a row to the list, in lower case, as the whole word that appears in food names
-- (a plural is its own row). Check the foods it catches first with
-- `select name from public.foods where name ~* '\mword\M'`, since it demotes every one of them.
--
-- 2. The penalty is waived for the whole food when a query word of 3 or more letters starts one of
-- its secondary words or one of them starts the query word: "casserole" and "casser" waive
-- "casseroled", "curr" waives "curry", "pie" waives "pie", and "stew" waives "stew" and "stewed".
-- One named word is enough, so "chicken tikka" keeps "Curry, chicken tikka masala, retail, reheated"
-- in place although curry and masala are not in the query, and "stew" keeps "Stew, beef, homemade"
-- first.
--
-- 3. `catalogue_boost` is 0.1 for the foods of the two bundled catalogues, source cofid and usda. The
-- Open Food Facts and user foods do not get it, as before.

create or replace function public.search_foods(q text, lim integer default 25)
returns table (
  id uuid,
  source public.food_source,
  name text,
  brand text,
  basis public.nutrient_basis,
  kcal numeric,
  protein_g numeric,
  fat_g numeric,
  carbs_g numeric,
  fibre_g numeric,
  quality jsonb,
  default_portion_id uuid,
  default_portion_label text,
  default_portion_grams numeric,
  default_portion_ml numeric,
  score real
)
language sql
stable
security invoker
set search_path = ''
as $$
  with
  weights as (
    select
      1.0::real as trigram_weight,
      0.3::real as own_food_boost,
      0.1::real as catalogue_boost,
      0.5::real as secondary_penalty,
      0.2::real as first_word_exact_boost,
      0.15::real as first_word_stem_boost,
      0.1::real as first_word_prefix_boost
  ),
  aliases as (
    -- Compound words that hide a common search word: (word, alias). A search for the word also finds
    -- the alias (CoFID has "Sweetcorn" and no "Corn" food). Add a pair here for another CoFID compound
    -- word that hides a word people type. The word is lower case, one word, and not a prefix of the alias.
    select * from (values ('corn', 'sweetcorn')) as alias_pairs (word, alias)
  ),
  secondary_words as (
    -- Words that mark a casseroled or stewed piece or a prepared dish. To add one, see the header.
    select * from (values
      ('casseroled'), ('casserole'), ('stewed'), ('stew'), ('braised'), ('curry'), ('korma'), ('tikka'),
      ('masala'), ('pie'), ('pasty'), ('ready meal'), ('sauce'), ('soup'), ('sandwich'), ('pizza'),
      ('lasagne'), ('fricassee'), ('chasseur'), ('satay'), ('battered'), ('breaded')
    ) as secondary_word_list (word)
  ),
  trimmed as (
    -- Capped at 100 characters: the trigram work runs over the whole query for every row, so cost grows with its length.
    select pg_catalog.left(pg_catalog.btrim(q), 100) as query
  ),
  words as (
    select
      split.word,
      split.position,
      split.position = pg_catalog.max(split.position) over () as is_last
    from trimmed
    cross join lateral pg_catalog.regexp_split_to_table(
      pg_catalog.regexp_replace(trimmed.query, '[^[:alnum:]]+', ' ', 'g'), ' '
    ) with ordinality as split (word, position)
    where split.word <> ''
  ),
  query_words as (
    -- The typed words long enough to waive a secondary word, in lower case.
    select pg_catalog.lower(words.word) as word
    from words
    where pg_catalog.char_length(words.word) >= 3
  ),
  aliased_words as (
    select words.word, words.position, words.is_last, aliases.alias
    from words
    left join aliases on aliases.word = pg_catalog.lower(words.word)
  ),
  phrase as (
    select
      coalesce(pg_catalog.string_agg(aliased_words.word, ' ' order by aliased_words.position), '') as joined,
      -- The same words with each alias in place of its word, for the trigram comparison.
      coalesce(pg_catalog.string_agg(coalesce(aliased_words.alias, aliased_words.word), ' ' order by aliased_words.position), '') as joined_with_aliases
    from aliased_words
  ),
  parsed as (
    select
      trimmed.query,
      phrase.joined as phrase,
      phrase.joined_with_aliases as phrase_with_aliases,
      pg_catalog.to_tsquery('english', (
        select pg_catalog.string_agg(
          case
            when aliased_words.alias is null
              then aliased_words.word || case when aliased_words.is_last then ':*' else '' end
            else '(' || aliased_words.word || case when aliased_words.is_last then ':*' else '' end
              || ' | ' || aliased_words.alias || case when aliased_words.is_last then ':*' else '' end || ')'
          end,
          ' & ' order by aliased_words.position
        )
        from aliased_words
      )) as tsquery,
      extensions.word_similarity(phrase.joined, phrase.joined || 'zz') as prefix_ceiling,
      last.word as last_word,
      last.alias as last_word_alias,
      (pg_catalog.ts_lexize('pg_catalog.english_stem'::pg_catalog.regdictionary, last.word))[1] as last_word_stem
    from trimmed
    cross join phrase
    left join lateral (
      select pg_catalog.lower(aliased_words.word) as word, aliased_words.alias
      from aliased_words
      where aliased_words.is_last
    ) as last on true
  ),
  scored as (
    select
      f.id, f.source, f.name, f.brand, f.basis, f.kcal, f.protein_g, f.fat_g,
      f.carbs_g, f.fibre_g, f.quality,
      default_portion.id as default_portion_id,
      default_portion.label as default_portion_label,
      default_portion.grams as default_portion_grams,
      default_portion.ml as default_portion_ml,
      pg_catalog.char_length(f.name) - pg_catalog.char_length(pg_catalog.replace(f.name, ',', '')) as comma_count,
      pg_catalog.round((
        -- At most 1, so a name that matches the typed word twice ("pigeon pea ... peanuts", "corn-fed")
        -- scores no more than one that matches it once, and the first word bonus decides.
        least(coalesce(pg_catalog.ts_rank_cd(f.search, (select parsed.tsquery from parsed)), 0), 1)
        + (select weights.trigram_weight from weights)
          * least(
            greatest(
              extensions.word_similarity((select parsed.phrase from parsed), f.name),
              case when (select parsed.phrase_with_aliases from parsed) <> (select parsed.phrase from parsed)
                then extensions.word_similarity((select parsed.phrase_with_aliases from parsed), f.name)
                else 0 end
            ),
            (select parsed.prefix_ceiling from parsed)
          )
        + case when f.owner_id = (select auth.uid())
            then (select weights.own_food_boost from weights) else 0 end
        + case when f.source in ('cofid', 'usda')
            then (select weights.catalogue_boost from weights) else 0 end
        - case when coalesce((
            -- True when the name holds secondary words and the query names none of them.
            select pg_catalog.bool_and(not exists (
              select 1
              from query_words
              where pg_catalog.starts_with(secondary_words.word, query_words.word)
                 or pg_catalog.starts_with(query_words.word, secondary_words.word)
            ))
            from secondary_words
            where f.name ~* ('\m' || secondary_words.word || '\M')
          ), false)
            then (select weights.secondary_penalty from weights) else 0 end
        + case
            when first_word.word is null then 0
            when first_word.word = (select parsed.last_word from parsed)
                 or first_word.word = (select parsed.last_word_alias from parsed)
              then (select weights.first_word_exact_boost from weights)
            -- The stemmer is the costly test, so it runs only when the two words begin alike.
            when pg_catalog.left(first_word.word, 2) = pg_catalog.left((select parsed.last_word from parsed), 2)
                 and (pg_catalog.ts_lexize('pg_catalog.english_stem'::pg_catalog.regdictionary, first_word.word))[1]
                   = (select parsed.last_word_stem from parsed)
              then (select weights.first_word_stem_boost from weights)
            when pg_catalog.left(first_word.word, pg_catalog.char_length((select parsed.last_word from parsed)))
                 = (select parsed.last_word from parsed)
              then (select weights.first_word_prefix_boost from weights)
            else 0 end
      )::numeric, 4)::real as score
    from public.foods f
    cross join lateral (
      select pg_catalog.lower((pg_catalog.regexp_match(f.name, '[[:alnum:]]+'))[1]) as word
    ) as first_word
    left join lateral (
      select p.id, p.label, p.grams, p.ml
      from public.food_portions p
      where p.food_id = f.id and p.is_default
      limit 1
    ) as default_portion on true
    where pg_catalog.char_length((select parsed.query from parsed)) >= 2
      and f.deleted_at is null
      and f.id in (
        select candidate.id
        from public.search_food_candidate_ids(
          (select parsed.phrase from parsed),
          (select parsed.tsquery from parsed)
        ) as candidate (id)
      )
  )
  select
    scored.id, scored.source, scored.name, scored.brand, scored.basis, scored.kcal,
    scored.protein_g, scored.fat_g, scored.carbs_g, scored.fibre_g, scored.quality,
    scored.default_portion_id, scored.default_portion_label, scored.default_portion_grams,
    scored.default_portion_ml, scored.score
  from scored
  order by
    scored.score desc,
    scored.comma_count,
    pg_catalog.char_length(scored.name),
    scored.name,
    scored.id
  limit greatest(1, least(coalesce(lim, 25), 50));
$$;

