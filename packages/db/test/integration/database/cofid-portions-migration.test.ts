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

/** The row count and a fingerprint of the rows, created_at included, so a row that is rewritten differently shows. */
const fingerprintOf = (codes: readonly string[]): string =>
  `select count(*), md5(coalesce(string_agg(portion::text, '|' order by portion.id), '')) ${sharedPortionsOf(codes)};`;

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
    expect(lines[0]).not.toMatch(/^0\|/);
    expect(lines[1]).toBe(lines[0]);
  });
});

// KEY-523, the fruit batch. The expected rows are the FoodData Central rows the portions file cites.
const fruitBatchCodes = [
  "14-025", // apricot
  "14-091", // fig
  "14-125", // kumquat
  "14-142", // lychee
  "14-178", // passion fruit
  "14-339", // cantaloupe wedges
  "14-376", // pineapple slices
  "14-380", // nectarine
  "14-382", // cherry
  "14-384", // grapefruit halves
  "14-391", // prune
  "14-392", // dried apricot
  "14-394", // date
  "14-395", // dried fig
] as const;
const nectarineCode = "14-380";
const dateCode = "14-394";

describe("the CoFID portions migration, applied to a database that has the fruit but no portions for it", () => {
  it("should give nectarines small, medium and large, with medium the default", () => {
    const lines = runRolledBack(
      `${deletePortionsOf([nectarineCode])}\n${migrationSql}\n${listPortionsOf([nectarineCode])}`,
    );

    expect(lines).toEqual([
      "14-380|1 small|129|f|0",
      "14-380|1 medium|142|t|1",
      "14-380|1 large|156|f|2",
    ]);
  });

  it("should give grapefruit its three half sizes, with the medium half the default", () => {
    const lines = runRolledBack(
      `${deletePortionsOf(["14-384"])}\n${migrationSql}\n${listPortionsOf(["14-384"])}`,
    );

    expect(lines).toEqual([
      "14-384|1/2 small|100|f|0",
      "14-384|1/2 medium|128|t|1",
      "14-384|1/2 large|166|f|2",
    ]);
  });

  it("should give dried dates both varieties, with Deglet Noor the default", () => {
    const lines = runRolledBack(
      `${deletePortionsOf([dateCode])}\n${migrationSql}\n${listPortionsOf([dateCode])}`,
    );

    expect(lines).toEqual(["14-394|1 Deglet Noor date|7.1|t|0", "14-394|1 Medjool date|24|f|1"]);
  });

  it("should leave every fruit with exactly one default portion", () => {
    const lines = runRolledBack(
      `${deletePortionsOf(fruitBatchCodes)}\n${migrationSql}\nselect food.source_ref, count(*) filter (where portion.is_default) ${sharedPortionsOf(fruitBatchCodes)} group by food.source_ref order by food.source_ref;`,
    );

    expect(lines).toEqual(fruitBatchCodes.map((code) => `${code}|1`));
  });

  it("should change nothing when its SQL is applied a second time", () => {
    const lines = runRolledBack(
      [
        deletePortionsOf(fruitBatchCodes),
        migrationSql,
        fingerprintOf(fruitBatchCodes),
        migrationSql,
        fingerprintOf(fruitBatchCodes),
      ].join("\n"),
    );

    expect(lines).toHaveLength(2);
    expect(lines[0]).not.toMatch(/^0\|/);
    expect(lines[1]).toBe(lines[0]);
  });

  it("should skip a fruit the database lacks without failing, and still write the other fruit", () => {
    const withoutNectarine = migrationSql.replaceAll(`'${nectarineCode}'`, "'99-999'");
    expect(withoutNectarine).not.toBe(migrationSql);

    const lines = runRolledBack(
      [
        deletePortionsOf([nectarineCode, dateCode]),
        withoutNectarine,
        `select count(*) ${sharedPortionsOf([nectarineCode])};`,
        `select count(*) ${sharedPortionsOf([dateCode])};`,
      ].join("\n"),
    );

    expect(lines).toEqual(["0", "2"]);
  });
});

// KEY-524, the vegetable and salad batch. The expected rows are the FoodData Central rows the portions file cites.
const vegetableBatchCodes = [
  "13-157", // asparagus spears
  "13-177", // Brussels sprout
  "13-190", // red cabbage leaf
  "13-502", // broccoli, raw
  "13-503", // broccoli, boiled
  "13-512", // cauliflower floret
  "13-582", // cabbage leaf
  "13-622", // sweetcorn ear, raw kernels
  "13-630", // Brussels sprout, boiled
  "13-631", // parsnip, boiled
  "13-634", // baby corn, boiled
  "13-656", // radish
] as const;
const asparagusCode = "13-157";
const broccoliCode = "13-502";
const sweetcornCode = "13-622";

describe("the CoFID portions migration, applied to a database that has the vegetables but no portions for them", () => {
  it("should give asparagus four spear sizes, with medium the default", () => {
    const lines = runRolledBack(
      `${deletePortionsOf([asparagusCode])}\n${migrationSql}\n${listPortionsOf([asparagusCode])}`,
    );

    expect(lines).toEqual([
      "13-157|1 small spear|12|f|0",
      "13-157|1 medium spear|16|t|1",
      "13-157|1 large spear|20|f|2",
      "13-157|1 extra large spear|24|f|3",
    ]);
  });

  it("should give raw broccoli a floret and a spear, with the floret the default", () => {
    const lines = runRolledBack(
      `${deletePortionsOf([broccoliCode])}\n${migrationSql}\n${listPortionsOf([broccoliCode])}`,
    );

    expect(lines).toEqual(["13-502|1 floret|11|t|0", "13-502|1 spear|31|f|1"]);
  });

  it("should give sweetcorn kernels the medium and large ear, with medium the default", () => {
    const lines = runRolledBack(
      `${deletePortionsOf([sweetcornCode])}\n${migrationSql}\n${listPortionsOf([sweetcornCode])}`,
    );

    expect(lines).toEqual(["13-622|1 medium ear|102|t|0", "13-622|1 large ear|143|f|1"]);
  });

  it("should leave every vegetable with exactly one default portion", () => {
    const lines = runRolledBack(
      `${deletePortionsOf(vegetableBatchCodes)}\n${migrationSql}\nselect food.source_ref, count(*) filter (where portion.is_default) ${sharedPortionsOf(vegetableBatchCodes)} group by food.source_ref order by food.source_ref;`,
    );

    expect(lines).toEqual(vegetableBatchCodes.map((code) => `${code}|1`));
  });

  it("should change nothing when its SQL is applied a second time", () => {
    const lines = runRolledBack(
      [
        deletePortionsOf(vegetableBatchCodes),
        migrationSql,
        fingerprintOf(vegetableBatchCodes),
        migrationSql,
        fingerprintOf(vegetableBatchCodes),
      ].join("\n"),
    );

    expect(lines).toHaveLength(2);
    expect(lines[0]).not.toMatch(/^0\|/);
    expect(lines[1]).toBe(lines[0]);
  });
});

// KEY-525, the bakery, dairy and eggs batch. The expected rows are the FoodData Central rows the portions file cites.
const bakeryDairyEggsBatchCodes = [
  "11-541", // English muffin
  "11-542", // English muffin, toasted
  "11-822", // rye crispbread
  "11-925", // wheat tortilla
  "11-970", // bagel
  "11-988", // croissant
  "12-493", // Emmental slice
  "12-527", // processed cheese slice
  "12-815", // quail egg
  "12-816", // turkey egg
  "12-920", // duck egg
] as const;
const bagelCode = "11-970";
const croissantCode = "11-988";
const tortillaCode = "11-925";
const eggCodes = ["12-815", "12-816", "12-920"] as const;

describe("the CoFID portions migration, applied to a database that has the bakery, cheese and eggs but no portions for them", () => {
  it("should give bagels small, medium and large, with medium the default", () => {
    const lines = runRolledBack(
      `${deletePortionsOf([bagelCode])}\n${migrationSql}\n${listPortionsOf([bagelCode])}`,
    );

    expect(lines).toEqual([
      "11-970|1 small bagel|69|f|0",
      "11-970|1 medium bagel|105|t|1",
      "11-970|1 large bagel|131|f|2",
    ]);
  });

  it("should give croissants small, medium and large, with medium the default", () => {
    const lines = runRolledBack(
      `${deletePortionsOf([croissantCode])}\n${migrationSql}\n${listPortionsOf([croissantCode])}`,
    );

    expect(lines).toEqual([
      "11-988|1 small croissant|42|f|0",
      "11-988|1 medium croissant|57|t|1",
      "11-988|1 large croissant|67|f|2",
    ]);
  });

  it("should give tortillas three diameters, with the 7 to 8 inch the default", () => {
    const lines = runRolledBack(
      `${deletePortionsOf([tortillaCode])}\n${migrationSql}\n${listPortionsOf([tortillaCode])}`,
    );

    expect(lines).toEqual([
      "11-925|1 tortilla, 6 inch|30|f|0",
      "11-925|1 tortilla, 7 to 8 inch|49|t|1",
      "11-925|1 tortilla, 10 inch|72|f|2",
    ]);
  });

  it("should give quail, turkey and duck eggs one egg each", () => {
    const lines = runRolledBack(
      `${deletePortionsOf(eggCodes)}\n${migrationSql}\n${listPortionsOf(eggCodes)}`,
    );

    expect(lines).toEqual(["12-815|1 egg|9|t|0", "12-816|1 egg|79|t|0", "12-920|1 egg|70|t|0"]);
  });

  it("should give the single-portion foods the weights the FoodData Central rows cite", () => {
    const singlePortionCodes = ["11-541", "11-542", "11-822", "12-493", "12-527"] as const;
    const lines = runRolledBack(
      `${deletePortionsOf(singlePortionCodes)}\n${migrationSql}\n${listPortionsOf(singlePortionCodes)}`,
    );

    expect(lines).toEqual([
      "11-541|1 muffin|57|t|0",
      "11-542|1 muffin|52|t|0",
      "11-822|1 crispbread|11|t|0",
      "12-493|1 slice|28|t|0",
      "12-527|1 slice|21|t|0",
    ]);
  });

  it("should leave every new food with exactly one default portion", () => {
    const lines = runRolledBack(
      `${deletePortionsOf(bakeryDairyEggsBatchCodes)}\n${migrationSql}\nselect food.source_ref, count(*) filter (where portion.is_default) ${sharedPortionsOf(bakeryDairyEggsBatchCodes)} group by food.source_ref order by food.source_ref;`,
    );

    expect(lines).toEqual(bakeryDairyEggsBatchCodes.map((code) => `${code}|1`));
  });

  it("should change nothing when its SQL is applied a second time", () => {
    const lines = runRolledBack(
      [
        deletePortionsOf(bakeryDairyEggsBatchCodes),
        migrationSql,
        fingerprintOf(bakeryDairyEggsBatchCodes),
        migrationSql,
        fingerprintOf(bakeryDairyEggsBatchCodes),
      ].join("\n"),
    );

    expect(lines).toHaveLength(2);
    expect(lines[0]).not.toMatch(/^0\|/);
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
