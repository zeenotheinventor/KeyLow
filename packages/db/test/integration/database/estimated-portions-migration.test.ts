import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

// Applies the committed estimated portions migration (supabase/migrations/*_estimated_portions.sql) to
// the running stack inside a transaction that is rolled back, so nothing persists and no other suite
// sees a change. A stack made by `supabase start` runs the migrations before the seeds, so the seeded
// CoFID foods do not exist when the migration runs there, and production already has them. The test
// therefore creates its own uniquely named foods, runs the statements itself and looks at those rows
// only. It counts nothing across the table.

const databaseContainer = "supabase_db_keylow";

const migrationsDirectory = new URL("../../../supabase/migrations/", import.meta.url);
const migrationName = readdirSync(migrationsDirectory)
  .filter((fileName) => fileName.endsWith("_estimated_portions.sql"))
  .sort()
  .at(-1);
if (migrationName === undefined) {
  throw new Error("There is no *_estimated_portions.sql migration");
}
const migrationSql = readFileSync(new URL(migrationName, migrationsDirectory), "utf8");

// Unique per run, so nothing here can meet a row another suite or an earlier run made.
const prefix = `key934-${randomBytes(4).toString("hex")}`;
const ownerId = "93400000-0000-4000-8000-000000000001";
const likePrefix = `${prefix} %`;

const nutrients = (kcal: number | null): string => (kcal === null ? "null" : String(kcal));

const cofidFood = (key: string, group: string, basis: string, kcal: number | null): string =>
  `insert into public.foods (source, source_ref, name, basis, kcal, food_group) values ('cofid', '${prefix}-${key}', '${prefix} ${key}', '${basis}', ${nutrients(kcal)}, '${group}');`;

const offFood = (key: string, basis: string, kcal: number | null): string =>
  `insert into public.foods (source, source_ref, name, basis, kcal, fetched_at) values ('off', '${prefix}-${key}', '${prefix} ${key}', '${basis}', ${nutrients(kcal)}, now());`;

const ownFood = (key: string, kcal: number): string =>
  `insert into public.foods (source, owner_id, name, basis, kcal) values ('user', '${ownerId}', '${prefix} ${key}', 'per_100g', ${String(kcal)});`;

const portion = (
  key: string,
  label: string,
  amount: number,
  isDefault: boolean,
  position: number,
  isOwn = false,
): string =>
  `insert into public.food_portions (food_id, owner_id, label, grams, is_default, position) select id, ${isOwn ? `'${ownerId}'` : "null"}, '${label}', ${String(amount)}, ${String(isDefault)}, ${String(position)} from public.foods where name = '${prefix} ${key}';`;

const setUp = [
  `insert into auth.users (instance_id, id, aud, role, email) values ('00000000-0000-0000-0000-000000000000', '${ownerId}', 'authenticated', 'authenticated', '${prefix}@keylow.test');`,
  // CoFID shaped, by group.
  cofidFood("a-burger", "MBG", "per_100g", 232),
  cofidFood("b-single-letter-group", "F", "per_100g", 100),
  cofidFood("c-two-letters-no-row", "FZ", "per_100g", 100),
  cofidFood("d-rice-dry", "AC", "per_100g", 350),
  cofidFood("e-rice-cooked", "AC", "per_100g", 120),
  cofidFood("f-milk", "BA", "per_100ml", 46),
  cofidFood("g-curated", "MB", "per_100g", 250),
  portion("g-curated", "1 muffin", 57, true, 0),
  // Open Food Facts shaped.
  offFood("h-off-no-portions", "per_100g", 250),
  offFood("i-off-unknown-energy", "per_100g", null),
  offFood("j-off-drink", "per_100ml", 45),
  offFood("k-off-measure-only", "per_100g", 250),
  portion("k-off-measure-only", "240 g", 240, true, 0),
  offFood("o-off-portions-no-default", "per_100g", 250),
  portion("o-off-portions-no-default", "1 tub", 200, false, 1),
  portion("o-off-portions-no-default", "1 pot", 125, false, 0),
  offFood("p-off-measure-first", "per_100g", 250),
  portion("p-off-measure-first", "30 g", 30, false, 0),
  portion("p-off-measure-first", "1 pack", 90, false, 1),
  // The person's own.
  ownFood("l-own-no-portions", 400),
  ownFood("m-own-portions-no-default", 400),
  // Inserted out of order, so the first portion is chosen by position and not by the order of the rows.
  portion("m-own-portions-no-default", "1 pack", 90, false, 1, true),
  portion("m-own-portions-no-default", "1 bar", 45, false, 0, true),
  ownFood("n-own-measure-label", 400),
  portion("n-own-measure-label", "240 g", 240, true, 0, true),
].join("\n");

const listPortions = `select food.name, portion.label, portion.grams, portion.ml, portion.is_default, portion.position, portion.owner_id is not distinct from food.owner_id from public.foods food join public.food_portions portion on portion.food_id = food.id where food.name like '${likePrefix}' order by food.name, portion.position;`;

/** The rows' fingerprint, created_at included, so a row that is rewritten differently shows. */
const fingerprint = `select count(*), md5(coalesce(string_agg(portion::text, '|' order by portion.id), '')) from public.food_portions portion join public.foods food on food.id = portion.food_id where food.name like '${likePrefix}';`;

/** Runs the script in a transaction that is rolled back, and returns what its selects printed, one line per row. */
function runRolledBack(script: string): string[] {
  const output = execFileSync(
    "docker",
    ["exec", "-i", databaseContainer, "psql", "-q", "-U", "postgres", "-d", "postgres", "-At"],
    { input: `\\set ON_ERROR_STOP on\nbegin;\n${script}\nrollback;\n`, encoding: "utf8" },
  );
  return output.split("\n").filter((line) => line !== "");
}

const line = (key: string, rest: string): string => `${prefix} ${key}|${rest}`;

describe("the estimated portions migration, applied to foods that have no default", () => {
  const lines = runRolledBack(`${setUp}\n${migrationSql}\n${listPortions}`);

  it("should give a CoFID food the row of its food group", () => {
    expect(lines).toContain(line("a-burger", "1 typical burger|200||t|0|t"));
  });

  it("should match a single letter group only against a single letter group", () => {
    expect(lines).toContain(line("b-single-letter-group", "1 typical serving|80||t|0|t"));
    // FZ is not F and not FA, so it falls through to its energy, which is 100 kcal.
    expect(lines).toContain(line("c-two-letters-no-row", "1 typical serving|150||t|0|t"));
  });

  it("should use the dry size from 250 kcal and the cooked size below it", () => {
    expect(lines).toContain(line("d-rice-dry", "1 typical serving|75||t|0|t"));
    expect(lines).toContain(line("e-rice-cooked", "1 typical serving|180||t|0|t"));
  });

  it("should size a drink in millilitres", () => {
    expect(lines).toContain(line("f-milk", "1 typical glass||200|t|0|t"));
  });

  it("should leave a food that already has a default untouched", () => {
    const own = lines.filter((text) => text.startsWith(`${prefix} g-curated|`));

    expect(own).toEqual([line("g-curated", "1 muffin|57||t|0|t")]);
  });

  it("should give a stored Open Food Facts food the row for its energy, or 100 g when it is not known", () => {
    expect(lines).toContain(line("h-off-no-portions", "1 typical serving|100||t|0|t"));
    expect(lines).toContain(line("i-off-unknown-energy", "1 typical serving|100||t|0|t"));
    expect(lines).toContain(line("j-off-drink", "1 typical serving||200|t|0|t"));
  });

  it("should relabel a shared default that is only a measure, keeping its size and adding no row", () => {
    const rows = lines.filter((text) => text.startsWith(`${prefix} k-off-measure-only|`));

    expect(rows).toEqual([line("k-off-measure-only", "1 serving|240||t|0|t")]);
  });

  it("should give the person's own food an estimate they own", () => {
    expect(lines).toContain(line("l-own-no-portions", "1 typical serving|40||t|0|t"));
  });

  it("should make the first portion of the person's own food the default and add no row", () => {
    const rows = lines.filter((text) => text.startsWith(`${prefix} m-own-portions-no-default|`));

    expect(rows).toEqual([
      line("m-own-portions-no-default", "1 bar|45||t|0|t"),
      line("m-own-portions-no-default", "1 pack|90||f|1|t"),
    ]);
  });

  it("should do the same for a shared food, by position and not by the order the rows were written", () => {
    const rows = lines.filter((text) => text.startsWith(`${prefix} o-off-portions-no-default|`));

    expect(rows).toEqual([
      line("o-off-portions-no-default", "1 pot|125||t|0|t"),
      line("o-off-portions-no-default", "1 tub|200||f|1|t"),
    ]);
  });

  it("should relabel a promoted shared portion that is only a measure, once it is the default", () => {
    const rows = lines.filter((text) => text.startsWith(`${prefix} p-off-measure-first|`));

    expect(rows).toEqual([
      line("p-off-measure-first", "1 serving|30||t|0|t"),
      line("p-off-measure-first", "1 pack|90||f|1|t"),
    ]);
  });

  it("should leave the person's own measure label alone", () => {
    const rows = lines.filter((text) => text.startsWith(`${prefix} n-own-measure-label|`));

    expect(rows).toEqual([line("n-own-measure-label", "240 g|240||t|0|t")]);
  });

  it("should leave every one of these foods with exactly one default", () => {
    const defaults = runRolledBack(
      `${setUp}\n${migrationSql}\nselect food.name, count(*) filter (where portion.is_default) from public.foods food left join public.food_portions portion on portion.food_id = food.id where food.name like '${likePrefix}' group by food.name order by food.name;`,
    );

    expect(defaults).toHaveLength(16);
    expect(defaults.every((text) => text.endsWith("|1"))).toBe(true);
  });
});

describe("the estimated portions migration, applied a second time", () => {
  it("should add and change nothing", () => {
    const lines = runRolledBack(
      [setUp, migrationSql, fingerprint, migrationSql, fingerprint].join("\n"),
    );

    expect(lines).toHaveLength(2);
    expect(lines[0]).not.toMatch(/^0\|/);
    expect(lines[1]).toBe(lines[0]);
  });
});
