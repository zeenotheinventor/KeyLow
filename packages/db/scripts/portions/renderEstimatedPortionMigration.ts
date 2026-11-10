import {
  ESTIMATE_CATEGORY_ROWS,
  ESTIMATE_DRY_KCAL_PER_100,
  ESTIMATE_ENERGY_BANDS_PER_100G,
  ESTIMATE_ENERGY_BANDS_PER_100ML,
  MEASURE_ONLY_PORTION_LABEL,
  estimatedPortion,
} from "@keylow/core";

import { sqlLiteral } from "../cofid/sqlLiteral";

import type { NutrientBasis } from "@keylow/core";

// The label of a measure only default after the relabel. Core words a serving the same way.
const SERVING_LABEL = "1 serving";

// Core matches a CoFID group on its first one or two letters, exactly, so a single letter row such as F
// only matches the group F. This is that rule in SQL.
const CODE_OF_GROUP = "substring(upper(btrim(food.food_group)) from '^[A-Z]{1,2}')";

const HAS_NO_DEFAULT =
  "not exists (select 1 from public.food_portions existing where existing.food_id = food.id and existing.is_default)";

// After the food's existing portions, so a chip the person already sees keeps its place.
const POSITION_AFTER_EXISTING =
  "coalesce((select max(existing.position) + 1 from public.food_portions existing where existing.food_id = food.id), 0)";

// The unique index allows one default per food, so a default written meanwhile is left as it is.
const INSERT_COLUMNS =
  "insert into public.food_portions (food_id, owner_id, label, grams, ml, is_default, position)";
const ON_CONFLICT = "on conflict (food_id) where is_default do nothing;";

const tuple = (values: readonly unknown[]): string => `(${values.map(sqlLiteral).join(", ")})`;

const sizeByBasis = (size: string): string =>
  `case when food.basis = 'per_100g' then ${size} end, case when food.basis = 'per_100ml' then ${size} end`;

/** Every CoFID group code of every core row in order, so the tuples are core's table and not a copy of it. */
function categoryTuples(): string[] {
  const codes = [...new Set(ESTIMATE_CATEGORY_ROWS.flatMap((row) => row.groups))];
  return codes.map((code) => {
    // `estimatedPortion` is asked for the code, once with a dry energy and once with a cooked one, so the
    // label and both sizes are exactly what core would give, whichever way a row writes its size.
    const dry = estimatedPortion({
      basis: "per_100g",
      kcal: ESTIMATE_DRY_KCAL_PER_100,
      foodGroup: code,
    });
    const cooked = estimatedPortion({ basis: "per_100g", kcal: 0, foodGroup: code });
    return tuple([code, dry.label, dry.grams, cooked.grams]);
  });
}

function bandTuples(): string[] {
  const bands: [NutrientBasis, typeof ESTIMATE_ENERGY_BANDS_PER_100G][] = [
    ["per_100g", ESTIMATE_ENERGY_BANDS_PER_100G],
    ["per_100ml", ESTIMATE_ENERGY_BANDS_PER_100ML],
  ];
  return bands.flatMap(([basis, list]) =>
    list.map((band) => {
      const estimate = estimatedPortion({ basis, kcal: band.from });
      return tuple([basis, band.from, estimate.grams ?? estimate.ml]);
    }),
  );
}

// A food with portions and no default opens on its first portion, the way `withDefaultPortion` chooses it:
// the lowest position, then the lowest id. One row per food is chosen from the foods that have no default,
// so no food gets two and the one-default index cannot be hit by this statement.
const promoteFirstPortionStatement = (): string =>
  [
    "update public.food_portions portion",
    "set is_default = true",
    "from (",
    "  select distinct on (candidate.food_id) candidate.id",
    "  from public.food_portions candidate",
    "  where not exists (select 1 from public.food_portions existing where existing.food_id = candidate.food_id and existing.is_default)",
    "  order by candidate.food_id, candidate.position, candidate.id",
    ") first_portion",
    "where portion.id = first_portion.id;",
  ].join("\n");

const relabelStatement = (): string =>
  [
    "update public.food_portions",
    `set label = ${sqlLiteral(SERVING_LABEL)}`,
    `where owner_id is null and is_default and label ${MEASURE_ONLY_PORTION_LABEL.flags.includes("i") ? "~*" : "~"} ${sqlLiteral(MEASURE_ONLY_PORTION_LABEL.source)};`,
  ].join("\n");

const categoryStatement = (): string =>
  [
    INSERT_COLUMNS,
    `select food.id, food.owner_id, estimate.label, ${sizeByBasis(`case when food.kcal >= ${String(ESTIMATE_DRY_KCAL_PER_100)} then estimate.dry_size else estimate.cooked_size end`)}, true, ${POSITION_AFTER_EXISTING}`,
    "from public.foods food",
    "join (values",
    `  ${categoryTuples().join(",\n  ")}`,
    `) as estimate (food_group, label, dry_size, cooked_size) on estimate.food_group = ${CODE_OF_GROUP}`,
    `where food.source = 'cofid' and ${HAS_NO_DEFAULT}`,
    ON_CONFLICT,
  ].join("\n");

function energyStatement(): string {
  const unknown = estimatedPortion({ basis: "per_100g", kcal: null });
  const size = `coalesce(band.size, ${String(unknown.grams)})`;
  return [
    INSERT_COLUMNS,
    `select food.id, food.owner_id, ${sqlLiteral(unknown.label)}, ${sizeByBasis(size)}, true, ${POSITION_AFTER_EXISTING}`,
    "from public.foods food",
    "left join lateral (",
    "  select band.size from (values",
    `    ${bandTuples().join(",\n    ")}`,
    "  ) as band (basis, lower_bound, size)",
    "  where band.basis = food.basis::text and food.kcal >= band.lower_bound",
    "  order by band.lower_bound desc limit 1",
    ") band on true",
    `where ${HAS_NO_DEFAULT}`,
    ON_CONFLICT,
  ].join("\n");
}

// The numbered statements, with the comment above each. The migration and the seed both hold exactly this text,
// so a fresh stack (which runs seeds after migrations, when no CoFID food exists yet) ends where production does.
const estimatedPortionStatements = (): string =>
  [
    "-- 1. A food of any source that has portions and no default opens on its first portion, the one with the lowest position. It gets no extra row.",
    promoteFirstPortionStatement(),
    "",
    "-- 2. A shared default whose label is only a measure, such as 240 g, reads as 1 serving. The size is unchanged and a person's own label is left alone.",
    relabelStatement(),
    "",
    "-- 3. A CoFID food with no default gets the row of its food group. The group is its first one or two letters, matched exactly.",
    categoryStatement(),
    "",
    "-- 4. Any food with no portions at all, of any source and including a person's own, gets the row for its energy. The size is in grams or millilitres by the food's basis.",
    energyStatement(),
  ].join("\n");

/**
 * The migration that gives every food a default portion that is not grams. It is written from core's
 * constants and from `estimatedPortion` itself, so no rule is written by hand in SQL and it cannot differ
 * from core when it is generated. It has no begin or commit, because the migration runner owns the
 * transaction. The text depends on nothing but core.
 */
export function renderEstimatedPortionMigration(): string {
  return `${[
    "-- Generated by packages/db/scripts/emit-estimated-portions.ts from the estimate table in @keylow/core. Do not edit by hand.",
    "-- Regenerate with: pnpm --filter @keylow/db emit:estimated-portions supabase/migrations/<timestamp>_estimated_portions.sql",
    "-- A change to the estimate table is a new generated migration, and an applied migration is never edited. Every statement is idempotent.",
    "-- It marks the first portion of a food with portions and no default as the default, relabels a shared default that is only a measure, and adds one row to a food with no portions at all, by food group for a CoFID food and by energy for the rest. It never deletes anything, and a food that already has a default keeps it.",
    "-- A logged entry keeps its own snapshot of the portion, so no entry changes.",
    "",
    estimatedPortionStatements(),
  ].join("\n")}\n`;
}

/**
 * The same statements as a seed, which runs after the migrations on a fresh stack, when the CoFID seeds have
 * only just loaded and the migration found no food to give a portion to. It is last in name order (90), so
 * every other seed has loaded. Like the other seeds it is one transaction, and every statement is idempotent.
 */
export function renderEstimatedPortionSeed(): string {
  return `${[
    "-- Generated by packages/db/scripts/emit-estimated-portions.ts --seed from the estimate table in @keylow/core. Do not edit by hand.",
    "-- Regenerate with: pnpm --filter @keylow/db emit:estimated-portions --seed supabase/seeds/90_estimated_portions.sql",
    "-- Runs after the other seeds, because the estimated portions migration finds no food on a fresh stack. Every statement is idempotent and the text is the migration's.",
    "begin;",
    estimatedPortionStatements(),
    "commit;",
  ].join("\n")}\n`;
}
