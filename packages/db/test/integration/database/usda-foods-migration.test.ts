import { execFileSync } from "node:child_process";

import { describe, expect, it } from "vitest";

import { sha256Hex } from "../../../scripts/cofid/checksum";
import { portionId } from "../../../scripts/portions/portionId";
import { renderUsdaMigration } from "../../../scripts/usda/renderUsdaMigration";
import { usdaFoodId } from "../../../scripts/usda/usdaFoodId";
import { normalisedCsvOf, rawThigh, roastedThigh } from "../../support/normalisedUsdaCsv";

// Applies the rendered USDA foods migration to the running stack inside a transaction that is rolled
// back, so nothing persists and no other suite sees a change. The migration is rendered here from two
// hand written rows, not read from supabase/migrations, so the test holds before and after the first
// real *_usda_foods.sql lands (KEY-760). The rows use FDC ids no real food has, so a USDA food that is
// already in the database cannot change what the test sees. The SQL goes through psql in the database
// container, the way a migration reaches the database whole, because PostgREST cannot run a
// rolled-back transaction. The container is named after project_id in supabase/config.toml.

const databaseContainer = "supabase_db_keylow";

const firstThigh = { ...rawThigh, fdc_id: "9990001" };
const secondThigh = { ...roastedThigh, fdc_id: "9990002" };
const csv = normalisedCsvOf(firstThigh, secondThigh);
const migrationSql = renderUsdaMigration(csv);

const fdcIds = "'9990001', '9990002'";
const usdaFoods = `from public.foods food where food.source = 'usda' and food.source_ref in (${fdcIds})`;
const portionsOfTheFoods = `from public.food_portions portion join public.foods food on food.id = portion.food_id where food.source = 'usda' and food.source_ref in (${fdcIds})`;

/** Runs the script in a transaction that is rolled back, and returns what its selects printed, one line per row. */
function runRolledBack(script: string): string[] {
  const output = execFileSync(
    "docker",
    ["exec", "-i", databaseContainer, "psql", "-q", "-U", "postgres", "-d", "postgres", "-At"],
    {
      input: `\\set ON_ERROR_STOP on\nbegin;\n${script}\nrollback;\n`,
      encoding: "utf8",
    },
  );
  return output.split("\n").filter((line) => line !== "");
}

describe("the USDA foods migration, applied to a database that has no USDA foods", () => {
  it("should add the two foods with the mapped kcal and their fdc ids as source_ref", () => {
    const lines = runRolledBack(
      `${migrationSql}\nselect food.source, food.source_ref, food.id, food.kcal, food.owner_id is null, food.name ${usdaFoods} order by food.source_ref;`,
    );

    expect(lines).toEqual([
      `usda|9990001|${usdaFoodId("9990001")}|221|t|Chicken, thigh, raw, meat and skin`,
      `usda|9990002|${usdaFoodId("9990002")}|232|t|Chicken, thigh, roasted, meat and skin`,
    ]);
  });

  it("should give each food its portion under the portion id, as the one default", () => {
    const lines = runRolledBack(
      `${migrationSql}\nselect food.source_ref, portion.id, portion.label, portion.grams, portion.is_default, portion.position, portion.owner_id is null ${portionsOfTheFoods} order by food.source_ref;`,
    );

    expect(lines).toEqual([
      `9990001|${portionId("usda:9990001", "1 thigh")}|1 thigh|193|t|0|t`,
      `9990002|${portionId("usda:9990002", "1 thigh")}|1 thigh|137|t|0|t`,
    ]);
  });

  it("should keep the normalised row as the source data of each food, under the import run", () => {
    const lines = runRolledBack(
      `${migrationSql}\nselect food.source_ref, run.source, run.label, run.row_count, run.finished_at is not null, data.raw ->> 'kcal' from public.food_source_data data join public.foods food on food.id = data.food_id join public.import_runs run on run.id = data.import_run_id where food.source = 'usda' and food.source_ref in (${fdcIds}) order by food.source_ref;`,
    );

    expect(lines).toEqual([
      "9990001|usda|usda-sr-2018-04|2|t|221",
      "9990002|usda|usda-sr-2018-04|2|t|232",
    ]);
  });
});

describe("the USDA foods migration, applied twice", () => {
  const sourceDataOfTheFoods = `from public.food_source_data data join public.foods food on food.id = data.food_id where food.source = 'usda' and food.source_ref in (${fdcIds})`;
  const fingerprint = `select (select count(*) ${usdaFoods}), (select count(*) ${sourceDataOfTheFoods}), (select count(*) from public.import_runs where file_sha256 = '${sha256Hex(csv)}'), (select count(*) ${portionsOfTheFoods}), (select count(*) ${portionsOfTheFoods} and portion.is_default), (select md5(coalesce(string_agg(food::text, '|' order by food.id), '')) ${usdaFoods});`;

  it("should leave two foods, one import run, one portion each and one default per food", () => {
    const lines = runRolledBack(`${migrationSql}\n${migrationSql}\n${fingerprint}`);

    expect(lines).toHaveLength(1);
    expect(lines[0]?.split("|").slice(0, 5)).toEqual(["2", "2", "1", "2", "2"]);
  });

  it("should change nothing the second time", () => {
    const lines = runRolledBack(`${migrationSql}\n${fingerprint}\n${migrationSql}\n${fingerprint}`);

    expect(lines).toHaveLength(2);
    expect(lines[1]).toBe(lines[0]);
  });
});

describe("the USDA foods migration, applied to a database that holds an earlier version of the foods", () => {
  it("should update a food whose name changed in the CSV in place, under the same id", () => {
    const renamed = renderUsdaMigration(
      normalisedCsvOf({ ...firstThigh, name: "Chicken, thigh, raw, with skin" }, secondThigh),
    );

    const lines = runRolledBack(
      `${migrationSql}\n${renamed}\nselect food.source_ref, food.id, food.name ${usdaFoods} order by food.source_ref;`,
    );

    expect(lines).toEqual([
      `9990001|${usdaFoodId("9990001")}|Chicken, thigh, raw, with skin`,
      `9990002|${usdaFoodId("9990002")}|Chicken, thigh, roasted, meat and skin`,
    ]);
  });

  it("should point the source data at the newer import run", () => {
    const changed = renderUsdaMigration(
      normalisedCsvOf({ ...firstThigh, kcal: "300" }, secondThigh),
    );

    const lines = runRolledBack(
      `${migrationSql}\n${changed}\nselect count(distinct data.import_run_id), min(data.raw ->> 'kcal') from public.food_source_data data join public.foods food on food.id = data.food_id where food.source = 'usda' and food.source_ref = '9990001';`,
    );

    expect(lines).toEqual(["1|300"]);
  });

  it("should correct a weight under the same portion id", () => {
    const corrected = renderUsdaMigration(
      normalisedCsvOf({ ...firstThigh, portion_grams: "200" }, secondThigh),
    );

    const lines = runRolledBack(
      `${migrationSql}\n${corrected}\nselect portion.id, portion.grams ${portionsOfTheFoods} and food.source_ref = '9990001';`,
    );

    expect(lines).toEqual([`${portionId("usda:9990001", "1 thigh")}|200`]);
  });

  it("should move the default without ever leaving two, and keep the portion it moved away from", () => {
    const lines = runRolledBack(
      [
        migrationSql,
        `update public.food_portions portion set is_default = false from public.foods food where food.id = portion.food_id and food.source = 'usda' and food.source_ref = '9990001';`,
        `insert into public.food_portions (food_id, label, grams, is_default, position) select id, 'Key759 old default', 10, true, 9 from public.foods where source = 'usda' and source_ref = '9990001';`,
        migrationSql,
        `select portion.label, portion.is_default ${portionsOfTheFoods} and food.source_ref = '9990001' order by portion.position;`,
      ].join("\n"),
    );

    expect(lines).toEqual(["1 thigh|t", "Key759 old default|f"]);
  });

  it("should leave a food that was soft deleted soft deleted", () => {
    const lines = runRolledBack(
      [
        migrationSql,
        `update public.foods set deleted_at = '2026-01-01T00:00:00Z' where source = 'usda' and source_ref = '9990001';`,
        migrationSql,
        `select food.source_ref, food.deleted_at is not null ${usdaFoods} order by food.source_ref;`,
      ].join("\n"),
    );

    expect(lines).toEqual(["9990001|t", "9990002|f"]);
  });
});

describe("search_foods, after the USDA foods migration", () => {
  it("should return both foods to an authenticated user, with source usda", () => {
    const userId = "75990000-0000-4000-8000-000000000001";
    const lines = runRolledBack(
      [
        migrationSql,
        "set local role authenticated;",
        `select set_config('request.jwt.claims', '{"sub":"${userId}","role":"authenticated"}', true);`,
        `select source, name from public.search_foods('chicken thigh', 100) where name in ('${firstThigh.name}', '${secondThigh.name}') and source = 'usda' order by name;`,
      ].join("\n"),
    ).filter((line) => line.startsWith("usda|"));

    expect(lines).toEqual([
      "usda|Chicken, thigh, raw, meat and skin",
      "usda|Chicken, thigh, roasted, meat and skin",
    ]);
  });
});
