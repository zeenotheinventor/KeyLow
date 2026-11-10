import { readdirSync, readFileSync } from "node:fs";

import {
  ESTIMATE_CATEGORY_ROWS,
  ESTIMATE_DRY_KCAL_PER_100,
  ESTIMATE_ENERGY_BANDS_PER_100G,
  ESTIMATE_ENERGY_BANDS_PER_100ML,
  ESTIMATE_UNKNOWN_ENERGY_SIZE,
  MEASURE_ONLY_PORTION_LABEL,
  estimatedPortionLabel,
} from "@keylow/core";
import { describe, expect, it } from "vitest";

import { renderEstimatedPortionMigration } from "../../../scripts/portions/renderEstimatedPortionMigration";

const migration = renderEstimatedPortionMigration();

/** The statements, one per block, with the comment lines taken out. */
const statementsOf = (sql: string): string[] =>
  sql
    .split("\n")
    .filter((line) => !line.startsWith("--"))
    .join("\n")
    .split("\n\n")
    .map((block) => block.trim())
    .filter((block) => block !== "");

/** The `(code, label, dry size, cooked size)` tuples of the category VALUES list, in order. */
const categoryTuples = (sql: string): [string, string, number, number][] =>
  [...sql.matchAll(/\('([A-Z]{1,2})', '([^']+)', (\d+), (\d+)\)/g)].map(
    ([, code = "", label = "", dry = "", cooked = ""]) => [
      code,
      label,
      Number(dry),
      Number(cooked),
    ],
  );

/** The `(basis, lower bound, size)` tuples of the energy band VALUES lists, in order. */
const bandTuples = (sql: string): [string, number, number][] =>
  [...sql.matchAll(/\('(per_100g|per_100ml)', (\d+), (\d+)\)/g)].map(
    ([, basis = "", from = "", size = ""]) => [basis, Number(from), Number(size)],
  );

describe("renderEstimatedPortionMigration", () => {
  describe("the category rows", () => {
    it("should list one tuple per CoFID group of every core row, with the label and both sizes", () => {
      const expected = ESTIMATE_CATEGORY_ROWS.flatMap((row) =>
        row.groups.map((code): [string, string, number, number] => [
          code,
          estimatedPortionLabel(row.noun),
          typeof row.size === "number" ? row.size : row.size.dry,
          typeof row.size === "number" ? row.size : row.size.cooked,
        ]),
      );

      expect(categoryTuples(migration)).toEqual(expected);
    });

    it("should keep single letter groups as single letters, so F only matches the group F", () => {
      const codes = categoryTuples(migration).map(([code]) => code);

      expect(codes).toEqual(expect.arrayContaining(["F", "G", "H", "P", "Q", "FA", "GA", "PA"]));
      expect(migration).toContain("substring(upper(btrim(food.food_group)) from '^[A-Z]{1,2}')");
    });

    it("should choose the dry size from the same energy core uses", () => {
      expect(migration).toContain(`food.kcal >= ${String(ESTIMATE_DRY_KCAL_PER_100)}`);
    });

    it("should give the rows to CoFID foods only", () => {
      const statement = statementsOf(migration).find((block) =>
        block.includes("estimate (food_group"),
      );

      expect(statement).toContain("food.source = 'cofid'");
    });
  });

  describe("the energy bands", () => {
    it("should list every core band for both bases, in ascending order", () => {
      const expected = [
        ...ESTIMATE_ENERGY_BANDS_PER_100G.map((band): [string, number, number] => [
          "per_100g",
          band.from,
          band.size,
        ]),
        ...ESTIMATE_ENERGY_BANDS_PER_100ML.map((band): [string, number, number] => [
          "per_100ml",
          band.from,
          band.size,
        ]),
      ];

      expect(bandTuples(migration)).toEqual(expected);
    });

    it("should use the label and the size core gives when the energy is unknown", () => {
      expect(migration).toContain(`'${estimatedPortionLabel("serving")}'`);
      expect(migration).toContain(`coalesce(band.size, ${String(ESTIMATE_UNKNOWN_ENERGY_SIZE)})`);
    });
  });

  describe("the first portion of a food with portions and no default", () => {
    const promotion = statementsOf(migration).find((block) =>
      block.startsWith("update public.food_portions portion"),
    );

    it("should be chosen by the lowest position and then the lowest id, as withDefaultPortion chooses it", () => {
      expect(promotion).toContain("distinct on (candidate.food_id) candidate.id");
      expect(promotion).toContain("order by candidate.food_id, candidate.position, candidate.id");
      expect(promotion).toContain("set is_default = true");
    });

    it("should only look at foods with no default, so it never makes a second one", () => {
      expect(promotion).toContain("not exists (select 1 from public.food_portions existing");
      expect(promotion).toContain("existing.is_default");
    });

    it("should run before every insert, so a food with portions gets no extra row", () => {
      const at = migration.indexOf("set is_default = true");

      expect(at).toBeGreaterThan(-1);
      expect(at).toBeLessThan(migration.indexOf("insert into"));
    });
  });

  describe("the relabel of a measure only default", () => {
    it("should be generated from the pattern core uses, for shared portions only", () => {
      const source = MEASURE_ONLY_PORTION_LABEL.source;

      expect(migration).toContain(`label ~* '${source}'`);
      expect(MEASURE_ONLY_PORTION_LABEL.flags).toContain("i");
      expect(migration).toContain("set label = '1 serving'");
      expect(migration).toContain("owner_id is null and is_default");
    });
  });

  describe("the statements", () => {
    it("should never delete or drop anything", () => {
      expect(migration).not.toMatch(/\b(delete|truncate|drop|alter)\b/i);
    });

    it("should add a portion only to a food that has no default, and never twice", () => {
      const inserts = statementsOf(migration).filter((block) => block.startsWith("insert into"));

      expect(inserts).toHaveLength(2);
      for (const insert of inserts) {
        expect(insert).toContain("not exists (select 1 from public.food_portions");
        expect(insert).toContain("and existing.is_default");
        expect(insert).toContain("on conflict (food_id) where is_default do nothing;");
      }
    });

    it("should copy the owner from the food and put the size in grams or millilitres by the food's basis", () => {
      const insert = statementsOf(migration).find((block) => block.startsWith("insert into"));

      expect(insert).toContain("food.owner_id");
      expect(insert).toContain("case when food.basis = 'per_100g'");
      expect(insert).toContain("case when food.basis = 'per_100ml'");
    });

    it("should put the portion after the existing ones", () => {
      expect(migration).toContain(
        "coalesce((select max(existing.position) + 1 from public.food_portions existing",
      );
    });

    it("should run the category rows before the energy bands", () => {
      expect(migration.indexOf("estimate (food_group")).toBeLessThan(
        migration.indexOf("band (basis"),
      );
    });

    it("should leave the transaction to the migration runner and give the same text every time", () => {
      expect(migration).not.toMatch(/^(begin|commit);|^set local /m);
      expect(renderEstimatedPortionMigration()).toBe(migration);
      expect(migration.endsWith("\n")).toBe(true);
    });

    it("should not use a dash or a semicolon to join two clauses in its comments", () => {
      const comments = migration
        .split("\n")
        .filter((line) => line.startsWith("--"))
        .map((line) => line.slice(2));

      expect(comments.join("\n")).not.toMatch(/—| -- |;/);
    });
  });
});

describe("the committed estimated portions migration", () => {
  it("should be what the core constants render, so the migration cannot drift from core", () => {
    const migrationsUrl = new URL("../../../supabase/migrations/", import.meta.url);
    const newestName = readdirSync(migrationsUrl)
      .filter((fileName) => fileName.endsWith("_estimated_portions.sql"))
      .sort()
      .at(-1);
    expect(newestName, "there is no *_estimated_portions.sql migration").toBeDefined();

    const committed = readFileSync(new URL(newestName ?? "", migrationsUrl), "utf8");

    // Compared as a boolean so a mismatch does not print two long strings.
    expect(
      committed === migration,
      "core's estimate table changed: generate a new migration as docs/runbooks/local-dev.md describes, and never edit an applied one",
    ).toBe(true);
  });
});
