-- Food search, second pass (KEY-64, KEY-59 and the database half of KEY-70):
--   1. ranking: a half typed last word matches by prefix only, with no bonus for
--      being a whole word, and ties fall back to the simpler name.
--   2. index use: candidates come from the two gin indexes through a security
--      definer helper, so they are used for an authenticated caller too.
--   3. lean rows: search_foods returns what a result list draws, not the whole
--      food (no micros, no food group, no provenance columns).
--   4. foods.name is capped at 200 characters in the database, as in core.
--   5. service_role loses TRUNCATE, REFERENCES and TRIGGER on the food tables.
-- Supersedes the header of 20261007020200_search_foods.sql where they differ.

-- 4. The same cap as `name` in core's customFoodInputSchema (z.string().trim().min(1).max(200)),
-- which is where a person's food name is limited. Open Food Facts names are cut to 200 characters
-- by the OFF normaliser in core (`capFoodName`) before they are written, so this check cannot
-- refuse an OFF write. The longest name in the seed and in the full CoFID import is 91 characters.
alter table public.foods
  add constraint foods_name_length_check check (pg_catalog.char_length(name) <= 200);

-- 5. The CLI default ACL leaves service_role with every table privilege. It
-- needs SELECT, INSERT, UPDATE and DELETE for the import scripts and nothing
-- else, the same as rate_limits already does.
revoke truncate, references, trigger
  on public.foods, public.food_portions, public.food_source_data, public.import_runs
  from service_role;

-- 2. Candidate ids for search_foods.
--
-- Why this exists. Under row level security the planner refuses an index
-- condition whose operator is not leakproof, and neither `@@` on a tsvector
-- nor pg_trgm's `%>` is, so the gin indexes foods_search_idx and
-- foods_name_trgm_idx were never used for a signed in caller. This function
-- runs with row level security off, so the planner may use them, and applies
-- the visibility rule itself.
--
-- The visibility filter mirrors the policy "foods_select" on public.foods:
--   owner_id is null or owner_id = auth.uid()
-- plus `deleted_at is null`, which the policy does not check but search never
-- returns. The service role bypasses row level security, so it sees every
-- live food here as well; it is recognised by the `role` setting that
-- PostgREST and `set role` establish, which a function cannot change.
-- If foods_select ever changes, change the filter below with it.
--
-- It only returns ids. search_foods (security invoker) reads those rows again
-- under the caller's row level security, so RLS still has the last word: a
-- wrong id here can only be dropped, never leak a row.
--
-- `search_phrase` is the query's words joined by single spaces and
-- `search_tsquery` the tsquery search_foods built from them. Both arrive
-- already sanitised, and arbitrary values are harmless: they are only used as
-- operands. Fewer than 2 characters returns nothing.
create function public.search_food_candidate_ids(search_phrase text, search_tsquery tsquery)
returns setof uuid
language sql
stable
-- A typical word matches tens of foods. Without this the planner assumes 1,000
-- and reads the whole of foods to find them, which is the scan this avoids.
rows 50
security definer
set search_path = ''
set row_security = off
as $$
  select f.id
  from public.foods f
  where pg_catalog.char_length(search_phrase) >= 2
    and f.deleted_at is null
    and (
      f.owner_id is null
      or f.owner_id = (select auth.uid())
      or pg_catalog.current_setting('role', true) = 'service_role'
    )
    and (
      f.search @@ search_tsquery
      or f.name operator(extensions.%>) search_phrase
    );
$$;

revoke execute on function public.search_food_candidate_ids(text, tsquery) from public, anon;
grant execute on function public.search_food_candidate_ids(text, tsquery) to authenticated, service_role;

-- 1 and 3. search_foods(q, lim), with a lean return type, so the old one goes.
drop function public.search_foods(text, integer);

-- Ranking. Score = ts_rank_cd + trigram weight * word_similarity + own food
-- boost + CoFID boost, as before, with two changes.
--
-- The word being typed is a prefix, not a word. word_similarity gives a food
-- whose word is exactly the last word a higher score than one whose word only
-- starts with it (the closing trigram of "chick" is in "chick peas" and not in
-- "chicken"), which put chick peas ahead of every chicken for "chick". The
-- trigram term is therefore capped at `prefix_ceiling`, what a food would score
-- if every word matched and the last one only began with the query. It is the
-- query's own words compared with themselves plus an extra tail, so it needs
-- no data. Spelling variants stay below the cap and keep their ordering.
--
-- A name that begins with the word being typed is the better match: "stew"
-- should find "Stew, beef" before "Damsons, stewed", and "onion" should find
-- "Onions, raw" before "Sweet potato and onion layer". The first word of the
-- name gets a bonus when it is the query's last word, a little less when it is
-- the same word by stem ("onions" for "onion"), and less again when it only
-- starts with it. Exact beats stem beats prefix, and all beat a match deeper
-- in the name. The bonuses
-- sit on top of the capped trigram term, so "chick" still puts every Chicken
-- ahead of chick peas.
--
-- Ties are broken for the simpler name: fewer commas ("Chicken slices" before
-- "Liver, chicken, raw"), then shorter, then name, then id. Scores are rounded to 4 places so floating point noise cannot hide a tie.
--
-- The weights are unchanged (see 20261007020200_search_foods.sql for their
-- reasons) and still live in the `weights` CTE:
--   trigram_weight 1.0, own_food_boost 0.3, cofid_boost 0.1, plus the new
--   first_word_exact_boost 0.2, first_word_stem_boost 0.15 and
--   first_word_prefix_boost 0.1.
-- M3 adds the "recently logged" boost here as one more term.
--
-- The query is trimmed, capped at 100 characters, and fewer than 2 characters
-- returns nothing. `lim` is clamped to 1..50, null means 25. The tsquery is
-- built from the query's words only (see the earlier migration): the last word
-- gets :*, every other word is an exact (stemmed) match, stop words are
-- dropped, and no part of `q` is ever parsed as tsquery syntax.
--
-- Lean rows. The columns are the ones the result lists draw and group by:
--   id, source (the Your foods / Common / Branded groups), name, brand, basis,
--   kcal, protein_g, fat_g, carbs_g (the row's stats line), fibre_g and
--   quality (the review flag), the food's default portion (the serving a
--   diary search row draws: default_portion_id, _label, _grams and _ml, all
--   null when the food has none), and score. A full food is read by id on tap.
-- Security invoker, so the caller's row level security applies to the re-read
-- and to the portion join: food_portions_select hides portions that are not
-- global or the caller's own. The join is deliberately not in the definer
-- helper. At most one portion per food is the default (food_portions_one_default_per_food_idx).
create function public.search_foods(q text, lim integer default 25)
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
  phrase as (
    select coalesce(pg_catalog.string_agg(words.word, ' ' order by words.position), '') as joined
    from words
  ),
  parsed as (
    select
      trimmed.query,
      phrase.joined as phrase,
      pg_catalog.to_tsquery('english', (
        select pg_catalog.string_agg(
          words.word || case when words.is_last then ':*' else '' end,
          ' & ' order by words.position
        )
        from words
      )) as tsquery,
      extensions.word_similarity(phrase.joined, phrase.joined || 'zz') as prefix_ceiling,
      last.word as last_word,
      (pg_catalog.ts_lexize('pg_catalog.english_stem'::pg_catalog.regdictionary, last.word))[1] as last_word_stem
    from trimmed
    cross join phrase
    left join lateral (
      select pg_catalog.lower(words.word) as word from words where words.is_last
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
        coalesce(pg_catalog.ts_rank_cd(f.search, (select parsed.tsquery from parsed)), 0)
        + (select weights.trigram_weight from weights)
          * least(
            extensions.word_similarity((select parsed.phrase from parsed), f.name),
            (select parsed.prefix_ceiling from parsed)
          )
        + case when f.owner_id = (select auth.uid())
            then (select weights.own_food_boost from weights) else 0 end
        + case when f.source = 'cofid'
            then (select weights.cofid_boost from weights) else 0 end
        + case
            when first_word.word is null then 0
            when first_word.word = (select parsed.last_word from parsed)
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

-- Signed-in users and the service role may search. anon may not, and the
-- default execute grant to public is removed so nothing else inherits it.
revoke execute on function public.search_foods(text, integer) from public, anon;
grant execute on function public.search_foods(text, integer) to authenticated, service_role;
