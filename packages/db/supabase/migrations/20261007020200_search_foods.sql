-- search_foods(q, lim): the one local food search both apps call. Full text
-- search plus trigram similarity, with the caller's own foods and the CoFID
-- catalogue boosted. Shape and rules come from docs/adr/0003-data-model.md
-- (Amendment 1) and the "Food search flow" in the build plan.
--
-- Matching. A food is a candidate when its `search` column (name weighted A,
-- brand weighted B) matches the query's tsquery, or when the query is word
-- similar to its name (`name %> q`, pg_trgm). The trigram arm carries what
-- stemming cannot: spelling differences such as "yoghurt" against CoFID's
-- "Yogurt", and typos. The gin indexes on foods (foods_search_idx and
-- foods_name_trgm_idx) can serve both arms, but only for a role that bypasses
-- row level security. Under RLS the planner refuses an index condition whose
-- operator is not leakproof, and neither `@@` on a tsvector nor pg_trgm's
-- `%>` is, so an authenticated caller gets a sequential scan today. That is
-- cheap at the CoFID catalogue's size, and is worth revisiting if the cached
-- Open Food Facts rows grow into the tens of thousands.
-- Acceptance criterion 'gin indexes in use' is not met under RLS. Measured
-- 8.7 ms at 3,000 rows. Follow-up ticket KEY-59 tracks the index work.
--
-- The tsquery is built from the query's words, never from the raw text. Every
-- run of characters that is not a letter or a digit becomes a word break, so
-- the operators and quoting of tsquery syntax (& | ! ( ) : * < > ' " and
-- backslash) are discarded before to_tsquery sees the text and arbitrary user
-- input cannot break the query or inject an operator. The words are joined
-- with &, and the last one gets :* so a half typed word matches by prefix
-- ("chick" finds "chicken"). Earlier words are exact (stemmed) matches.
-- Stop words are dropped by to_tsquery itself, and a query that is nothing but
-- stop words or punctuation has no tsquery, so only the trigram arm can match
-- it. The `q` argument itself is only ever passed to pg_trgm as a plain value.
--
-- Score = ts_rank_cd + trigram weight * word_similarity + own food boost +
-- CoFID boost. Both similarity terms are roughly 0 to 1, so the weights below
-- are read on that scale. They are named in the `weights` CTE so retuning is
-- a one line change plus a `create or replace function`.
--   trigram_weight 1.0   Equal to the full text rank: spelling variants must
--                        be able to compete with exact stems.
--   own_food_boost 0.3   Large enough that a user's own food beats an
--                        otherwise identical catalogue food, including the
--                        CoFID one (0.3 > 0.1), small enough that a clearly
--                        better match for a different food still wins.
--   cofid_boost    0.1   A tie breaker that puts the curated generic food
--                        ahead of a packaged Open Food Facts food with the
--                        same words ("chicken breast" finds CoFID first).
-- M3 adds the "recently logged" boost here, as one more term in the score
-- expression and one more weights column, when food_log_entries exists. It
-- ships with `create or replace function`, not a new function. It is not
-- part of this migration.
--
-- Security invoker, so the caller's row level security on foods applies:
-- foods_select already hides every other user's foods. Visibility is not
-- re-implemented here. Soft deleted rows stay visible to RLS by design, so the
-- function filters `deleted_at is null` itself.
--
-- The query is trimmed, and fewer than 2 characters returns nothing (the apps
-- search from 2 characters). `lim` is clamped to 1..50 and a null `lim` means
-- the default of 25, which the apps rely on to decide whether fewer than 5
-- local hits should trigger an Open Food Facts search. Ties on score fall back
-- to name, then id, so the order is stable.
--
-- The returned columns are every column of foods except the generated
-- `search` tsvector, in table order, then score. The tsvector is only useful
-- inside the database, and the core Food schema omits it too.
create function public.search_foods(q text, lim integer default 25)
returns table (
  id uuid,
  source public.food_source,
  source_ref text,
  owner_id uuid,
  name text,
  brand text,
  barcode text,
  basis public.nutrient_basis,
  density_g_per_ml numeric,
  kcal numeric,
  protein_g numeric,
  fat_g numeric,
  sat_fat_g numeric,
  carbs_g numeric,
  sugars_g numeric,
  fibre_g numeric,
  salt_g numeric,
  micros jsonb,
  quality jsonb,
  food_group text,
  fetched_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz,
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
      0.1::real as cofid_boost
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
  parsed as (
    select
      trimmed.query,
      pg_catalog.to_tsquery('english', (
        select pg_catalog.string_agg(
          words.word || case when words.is_last then ':*' else '' end,
          ' & ' order by words.position
        )
        from words
      )) as tsquery
    from trimmed
  ),
  scored as (
    select
      f.id, f.source, f.source_ref, f.owner_id, f.name, f.brand, f.barcode, f.basis,
      f.density_g_per_ml, f.kcal, f.protein_g, f.fat_g, f.sat_fat_g, f.carbs_g,
      f.sugars_g, f.fibre_g, f.salt_g, f.micros, f.quality, f.food_group,
      f.fetched_at, f.deleted_at, f.created_at,
      (
        coalesce(pg_catalog.ts_rank_cd(f.search, (select parsed.tsquery from parsed)), 0)
        + (select weights.trigram_weight from weights)
          * extensions.word_similarity((select parsed.query from parsed), f.name)
        + case when f.owner_id = (select auth.uid())
            then (select weights.own_food_boost from weights) else 0 end
        + case when f.source = 'cofid'
            then (select weights.cofid_boost from weights) else 0 end
      )::real as score
    from public.foods f
    where pg_catalog.char_length((select parsed.query from parsed)) >= 2
      and f.deleted_at is null
      and (
        f.search @@ (select parsed.tsquery from parsed)
        or f.name operator(extensions.%>) (select parsed.query from parsed)
      )
  )
  select scored.*
  from scored
  order by scored.score desc, scored.name, scored.id
  limit greatest(1, least(coalesce(lim, 25), 50));
$$;

-- Signed-in users and the service role may search. anon may not, and the
-- default execute grant to public is removed so nothing else inherits it.
revoke execute on function public.search_foods(text, integer) from public, anon;
grant execute on function public.search_foods(text, integer) to authenticated, service_role;
