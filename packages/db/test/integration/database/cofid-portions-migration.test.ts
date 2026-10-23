import { execFileSync } from "node:child_process";

import { describe, expect, it } from "vitest";

import { portionId } from "../../../scripts/portions/portionId";
import { readNewestPortionMigration } from "../../support/newestPortionMigration";

// Applies the committed portions migration (supabase/migrations/*_cofid_portions.sql) to the running
// stack inside a transaction that is rolled back, so nothing persists and no other suite sees a change.
// The shared stack's own portions may or may not have come from the seed, so each test first sets up
// the state production is in (the food has no portions) or a state the migration has to correct.
// The SQL goes through psql in the database container, the way a migration reaches the database
// whole, because PostgREST cannot run a rolled-back transaction. The container is named after
// project_id in supabase/config.toml.

const databaseContainer = "supabase_db_keylow";
const { sql: migrationSql } = readNewestPortionMigration();

const garlicCode = "13-244";
const celeryCode = "13-636";

const sqlList = (codes: readonly string[]): string => codes.map((code) => `'${code}'`).join(", ");

const sharedPortionsOf = (codes: readonly string[]): string =>
  `from public.food_portions portion join public.foods food on food.id = portion.food_id where food.source = 'cofid' and food.source_ref in (${sqlList(codes)}) and portion.owner_id is null`;

const deletePortionsOf = (codes: readonly string[]): string =>
  `delete from public.food_portions portion using public.foods food where food.id = portion.food_id and food.source = 'cofid' and food.source_ref in (${sqlList(codes)}) and portion.owner_id is null;`;

const listPortionsOf = (codes: readonly string[]): string =>
  `select food.source_ref, portion.label, portion.grams, portion.is_default, portion.position ${sharedPortionsOf(codes)} order by food.source_ref, portion.position;`;

/** A fingerprint of the rows, created_at included, so a row that is rewritten differently shows. */
const fingerprintOf = (codes: readonly string[]): string =>
  `select md5(coalesce(string_agg(portion::text, '|' order by portion.id), '')) ${sharedPortionsOf(codes)};`;

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

describe("the CoFID portions migration, applied to a database that has the foods but no portions", () => {
  it("should give garlic 1 clove", () => {
    const lines = runRolledBack(
      `${deletePortionsOf([garlicCode])}\n${migrationSql}\n${listPortionsOf([garlicCode])}`,
    );

    expect(lines).toEqual(["13-244|1 clove|3|t|0"]);
  });

  it("should give celery three stalks, with medium the default", () => {
    const lines = runRolledBack(
      `${deletePortionsOf([celeryCode])}\n${migrationSql}\n${listPortionsOf([celeryCode])}`,
    );

    expect(lines).toEqual([
      "13-636|1 small stalk|17|f|0",
      "13-636|1 medium stalk|40|t|1",
      "13-636|1 large stalk|64|f|2",
    ]);
  });

  it("should change nothing when its SQL is applied a second time", () => {
    const codes = [garlicCode, celeryCode];
    const lines = runRolledBack(
      [
        deletePortionsOf(codes),
        migrationSql,
        fingerprintOf(codes),
        migrationSql,
        fingerprintOf(codes),
      ].join("\n"),
    );

    expect(lines).toHaveLength(2);
    expect(lines[1]).toBe(lines[0]);
  });
});

// Each test applies the migration once first, so there are portions to change before it runs again.
describe("the CoFID portions migration, applied again to portions that differ from the file", () => {
  it("should correct a weight and a label under the same id", () => {
    const lines = runRolledBack(
      [
        migrationSql,
        `update public.food_portions portion set grams = 999, label = 'changed', position = 99 from public.foods food where food.id = portion.food_id and food.source = 'cofid' and food.source_ref = '${garlicCode}' and portion.owner_id is null and portion.id = '${portionId(garlicCode, "1 clove")}';`,
        migrationSql,
        listPortionsOf([garlicCode]),
      ].join("\n"),
    );

    expect(lines).toEqual(["13-244|1 clove|3|t|0"]);
  });

  it("should move the default without ever leaving two, and leave a portion the file does not list", () => {
    const lines = runRolledBack(
      [
        migrationSql,
        `update public.food_portions portion set is_default = false from public.foods food where food.id = portion.food_id and food.source = 'cofid' and food.source_ref = '${celeryCode}' and portion.owner_id is null;`,
        `insert into public.food_portions (food_id, label, grams, is_default, position) select food.id, 'Key514 old default', 10, true, 9 from public.foods food where food.source = 'cofid' and food.source_ref = '${celeryCode}';`,
        migrationSql,
        `select portion.label, portion.is_default ${sharedPortionsOf([celeryCode])} order by portion.position;`,
      ].join("\n"),
    );

    expect(lines).toEqual([
      "1 small stalk|f",
      "1 medium stalk|t",
      "1 large stalk|f",
      "Key514 old default|f",
    ]);
  });
});

describe("the CoFID portions migration, applied to a database that lacks a food", () => {
  it("should skip the food without failing, and still write the foods it has", () => {
    // The migration reads the same file with garlic's code swapped for one no food has.
    const withoutGarlic = migrationSql.replaceAll(`'${garlicCode}'`, "'99-999'");
    const garlicPortionId = portionId(garlicCode, "1 clove");
    expect(withoutGarlic).not.toBe(migrationSql);

    const lines = runRolledBack(
      [
        deletePortionsOf([garlicCode, celeryCode]),
        withoutGarlic,
        `select count(*) from public.food_portions where id = '${garlicPortionId}';`,
        `select count(*) ${sharedPortionsOf([celeryCode])};`,
      ].join("\n"),
    );

    expect(lines).toEqual(["0", "3"]);
  });
});
