import { describe, expect, it } from "vitest";

import { formatCsv } from "../../../scripts/cofid/csv";
import { importCofid } from "../../../scripts/cofid/importFoods";
import { mapRow } from "../../../scripts/cofid/mapRow";
import {
  createSqlSeedStore,
  SEED_RUN_ID,
  SEED_FOOD_COLUMNS,
} from "../../../scripts/cofid/sqlSeedStore";
import { COFID_COLUMNS, cofidRow } from "../../support/cofidRow";

const header = [...Object.keys(cofidRow()), "vitamins_retinol_ug"];
const food = (code: string, overrides: Record<string, string> = {}) =>
  cofidRow({ food_code: code, food_name: `Food ${code}`, ...overrides });
const csvOf = (...rows: Record<string, string>[]): string =>
  formatCsv([header, ...rows.map((row) => header.map((name) => row[name] ?? ""))]);

const sha256 = "a".repeat(64);

async function emit(csv: string, options: { subsetCodes?: string[]; batchSize?: number } = {}) {
  const store = createSqlSeedStore();
  await importCofid(store, {
    csv,
    fileSha256: sha256,
    label: "seed-subset",
    ...(options.subsetCodes === undefined ? {} : { subsetCodes: options.subsetCodes }),
    dryRun: false,
    batchSize: options.batchSize ?? 100,
    log: () => undefined,
  });
  return store.render();
}

const statementsStartingWith = (sql: string, start: string): string[] =>
  sql.split("\n").filter((line) => line.startsWith(start));

describe("createSqlSeedStore", () => {
  it("should wrap the file in one transaction", async () => {
    const sql = await emit(csvOf(food("11-1")));

    const lines = sql.split("\n").filter((line) => !line.startsWith("--") && line !== "");
    expect(lines[0]).toBe("begin;");
    expect(lines[1]).toBe("set local standard_conforming_strings = on;");
    expect(lines.at(-1)).toBe("commit;");
    expect(sql.match(/^begin;$/gm)).toHaveLength(1);
    expect(sql.match(/^commit;$/gm)).toHaveLength(1);
  });

  it("should insert one finished import run with the fixed id and the label, leaving an existing run alone", async () => {
    const sql = await emit(csvOf(food("11-1"), food("11-2")));

    const [runInsert] = statementsStartingWith(sql, "insert into public.import_runs");
    expect(runInsert).toBe(
      `insert into public.import_runs (id, source, label, file_sha256, started_at, finished_at, row_count) values ('${SEED_RUN_ID}', 'cofid', 'seed-subset', '${sha256}', now(), now(), 2) on conflict (id) do nothing;`,
    );
    expect(statementsStartingWith(sql, "insert into public.import_runs")).toHaveLength(1);
  });

  it("should put the import run before every food that points at it", async () => {
    const sql = await emit(csvOf(food("11-1")));

    expect(sql.indexOf("insert into public.import_runs")).toBeLessThan(
      sql.indexOf("insert into public.foods"),
    );
    expect(sql.indexOf("insert into public.foods")).toBeLessThan(
      sql.indexOf("insert into public.food_source_data"),
    );
  });

  it("should upsert each food on source and source_ref, updating every mapped column", async () => {
    const sql = await emit(csvOf(food("11-1")));

    const [foodInsert] = statementsStartingWith(sql, "insert into public.foods");
    expect(foodInsert).toContain(
      `(${SEED_FOOD_COLUMNS.join(", ")}) values ('cofid', '11-1', null, 'Food 11-1'`,
    );
    expect(foodInsert).toContain("on conflict (source, source_ref) do update set ");
    const updated = SEED_FOOD_COLUMNS.filter(
      (column) => column !== "source" && column !== "source_ref",
    );
    expect(foodInsert).toContain(
      `do update set ${updated.map((column) => `${column} = excluded.${column}`).join(", ")};`,
    );
  });

  it("should list every column the mapping produces, so no mapped value is dropped", () => {
    const { food: mapped } = mapRow(food("11-1"));

    expect([...SEED_FOOD_COLUMNS].sort()).toEqual(Object.keys(mapped).sort());
  });

  it("should upsert each source data row on food_id, finding the food by source and source_ref", async () => {
    const sql = await emit(csvOf(food("11-1", { food_name: "Bread" })));

    const [sourceDataInsert] = statementsStartingWith(sql, "insert into public.food_source_data");
    expect(sourceDataInsert).toMatch(
      /^insert into public\.food_source_data \(food_id, import_run_id, raw\) values \(\(select id from public\.foods where source = 'cofid' and source_ref = '11-1'\), '[0-9a-f-]{36}', '\{.*\}'::jsonb\) on conflict \(food_id\) do update set import_run_id = excluded\.import_run_id, raw = excluded\.raw;$/,
    );
    expect(sourceDataInsert).toContain(`'${SEED_RUN_ID}'`);
    expect(sourceDataInsert).toContain(`"food_name":"Bread"`);
  });

  it("should write a statement per line, one food and one source data row per food", async () => {
    const sql = await emit(csvOf(food("11-1"), food("11-2"), food("11-3")), { batchSize: 2 });

    expect(statementsStartingWith(sql, "insert into public.foods")).toHaveLength(3);
    expect(statementsStartingWith(sql, "insert into public.food_source_data")).toHaveLength(3);
  });

  it("should order the foods by code, comparing the numbers in a code as numbers", async () => {
    const sql = await emit(csvOf(food("11-10"), food("12-1"), food("11-2"), food("2-5")));

    const codes = statementsStartingWith(sql, "insert into public.foods").map(
      (line) => /values \('cofid', '([^']+)'/.exec(line)?.[1],
    );
    expect(codes).toEqual(["2-5", "11-2", "11-10", "12-1"]);
  });

  it("should write nulls and numbers unquoted", async () => {
    const sql = await emit(
      csvOf(
        food("11-1", {
          [COFID_COLUMNS.kcal]: "76.7",
          [COFID_COLUMNS.protein]: "N",
          [COFID_COLUMNS.fat]: "Tr",
          [COFID_COLUMNS.sodium]: "240",
        }),
      ),
    );

    const [foodInsert] = statementsStartingWith(sql, "insert into public.foods");
    // brand, barcode and density are null, then kcal, protein, fat, sat fat, carbs, sugars, fibre and salt.
    expect(foodInsert).toContain(
      "'per_100g', null, 76.7, null, 0, null, null, null, null, 0.6, '{}'::jsonb",
    );
  });

  it("should write micros and quality as jsonb with their quotes doubled", async () => {
    const sql = await emit(
      csvOf(
        food("11-1", {
          food_name: 'Baker\'s "best" loaf \\ crème',
          [COFID_COLUMNS.protein]: "N",
          vitamins_retinol_ug: "Tr",
        }),
      ),
    );

    const [foodInsert] = statementsStartingWith(sql, "insert into public.foods");
    expect(foodInsert).toContain(`'Baker''s "best" loaf \\ crème'`);
    expect(foodInsert).toContain(`'{"vitamins_retinol_ug":0}'::jsonb`);
    expect(foodInsert).toContain(
      `'{"suspect":true,"fields_missing":["kcal","protein_g","fat_g","carbs_g","fibre_g"],"trace_fields":["vitamins_retinol_ug"]}'::jsonb`,
    );
    const [sourceDataInsert] = statementsStartingWith(sql, "insert into public.food_source_data");
    expect(sourceDataInsert).toContain(`"food_name":"Baker''s \\"best\\" loaf \\\\ crème"`);
  });

  it("should write the same bytes for the same input", async () => {
    const csv = csvOf(food("11-2"), food("11-1", { [COFID_COLUMNS.kcal]: "250" }));

    expect(await emit(csv)).toBe(await emit(csv));
  });

  it("should write the same bytes whatever order the foods come in", async () => {
    const forwards = await emit(csvOf(food("11-1"), food("11-2"), food("11-3")));
    const backwards = await emit(csvOf(food("11-3"), food("11-2"), food("11-1")), { batchSize: 1 });

    expect(backwards).toBe(forwards);
  });

  it("should end the file with a newline and hold no timestamp but now()", async () => {
    const sql = await emit(csvOf(food("11-1")));

    expect(sql.endsWith("commit;\n")).toBe(true);
    expect(sql).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it("should refuse to render a run that was never finished", async () => {
    const store = createSqlSeedStore();
    const runId = await store.startRun({ label: "seed-subset", fileSha256: sha256 });
    await store.writeBatch(runId, [mapRow(food("11-1"))]);

    expect(() => store.render()).toThrow("not finished");
  });

  it("should refuse to render before a run was started", () => {
    expect(() => createSqlSeedStore().render()).toThrow("not finished");
  });
});
