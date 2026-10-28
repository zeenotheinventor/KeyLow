-- Food search, plain foods first (KEY-754):
--   1. repeated matches do not add up: the full-text term is capped at 1, so a name that matches
--      the typed word twice ("Curry, pigeon pea dahl with tomatoes and peanuts", "Chicken, corn-fed")
--      no longer beats a name that begins with it ("Peas, raw", "Corn snacks").
--   2. compound word aliases: "corn" also finds "Sweetcorn", which has no whole word "corn".
-- Replaces public.search_foods from 20261015180000_search_foods_ranking_and_index_use.sql and changes
-- nothing else: same signature, return type and grants (create or replace keeps them),
-- search_food_candidate_ids unchanged, and every weight in the `weights` CTE as it was.
--
-- 1. ts_rank_cd is unbounded and counts every match, and a prefix tsquery such as `pea:*` matches both
-- `pea` and `peanut`, so a dish that mentions the word twice outscored every plain food (the curry at
-- 2.7 against 2.1 for "Peas, raw"). Capped at 1 they tie, and the first word bonus puts the plain
-- food first.
--
-- 2. The `aliases` CTE holds (word, alias) pairs, today only ('corn', 'sweetcorn'). For a query word
-- with an alias, the tsquery term is (word:* | alias:*) so the alias foods become candidates through
-- the gin index, a name whose first word is the alias gets the exact first word bonus, and the
-- trigram term is the greater of the similarity to the typed phrase and to the phrase with the alias
-- in its place, still capped at `prefix_ceiling`.

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
      0.1::real as cofid_boost,
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
        + case when f.source = 'cofid'
            then (select weights.cofid_boost from weights) else 0 end
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

