import { foodRowSchema } from "@keylow/core";
import { describe, expect, it } from "vitest";

import { sha256Hex } from "../../../scripts/cofid/checksum";
import { formatCsv } from "../../../scripts/cofid/csv";
import { importCofid } from "../../../scripts/cofid/importFoods";
import { createSupabaseImportStore } from "../../../scripts/cofid/supabaseImportStore";
import { COFID_COLUMNS, cofidRow } from "../../support/cofidRow";
import { adminClient } from "../support/stack";

import type { ImportStore } from "../../../scripts/cofid/importFoods";

type TestRun = {
  label: string;
  codes: [string, string];
  /** The CSV text for two foods with these kcal values. */
  csvWith: (firstKcal: string, secondKcal: string) => string;
};

// Every column the mapping reads, and one micronutrient column besides.
const header = [...Object.keys(cofidRow()), "vitamins_retinol_ug"];

/** Deleting a food takes its source data with it, and only then can the runs they pointed at go. */
async function removeTestRows(label: string, codes: readonly string[]): Promise<void> {
  const admin = adminClient();
  const { error: foodsError } = await admin
    .from("foods")
    .delete()
    .in("source_ref", [...codes]);
  const { error: runsError } = await admin.from("import_runs").delete().eq("label", label);
  if (foodsError || runsError) {
    throw new Error("Could not remove the test rows", { cause: foodsError ?? runsError });
  }
}

/**
 * Gives the test its own label and food codes (`TEST-<uuid>-n`, which no CoFID code can equal), and
 * removes every row it made afterwards, whether the test passed or not.
 */
async function withTestRun(body: (run: TestRun) => Promise<void>): Promise<void> {
  const tag = crypto.randomUUID();
  const codes: [string, string] = [`TEST-${tag}-1`, `TEST-${tag}-2`];
  const label = `test-${tag}`;

  const csvWith = (firstKcal: string, secondKcal: string): string =>
    formatCsv([
      header,
      ...[
        cofidRow({
          food_code: codes[0],
          food_name: "Test food one",
          [COFID_COLUMNS.kcal]: firstKcal,
        }),
        cofidRow({
          food_code: codes[1],
          food_name: "Test food two",
          food_group: "QA",
          [COFID_COLUMNS.kcal]: secondKcal,
          [COFID_COLUMNS.protein]: "Tr",
          [COFID_COLUMNS.sodium]: "240",
          vitamins_retinol_ug: "Tr",
        }),
      ].map((row) => header.map((name) => row[name] ?? "")),
    ]);

  try {
    await body({ label, codes, csvWith });
  } finally {
    await removeTestRows(label, codes);
  }
}

/** One cell of a `food_source_data.raw` object, which the database types as plain JSON. */
function rawCell(raw: unknown, column: string): unknown {
  return typeof raw === "object" && raw !== null && column in raw
    ? Object.entries(raw).find(([name]) => name === column)?.[1]
    : undefined;
}

const importInto = (csv: string, label: string) =>
  importCofid(createSupabaseImportStore(adminClient()), {
    csv,
    fileSha256: sha256Hex(csv),
    label,
    dryRun: false,
    batchSize: 100,
    log: () => undefined,
  });

async function readFoods(codes: readonly string[]) {
  const { data, error } = await adminClient()
    .from("foods")
    .select("*")
    .eq("source", "cofid")
    .in("source_ref", [...codes])
    .order("source_ref");
  if (error) {
    throw new Error("Could not read the test foods", { cause: error });
  }
  return data;
}

describe("the CoFID import", () => {
  it("should leave one run per import and one food per code, holding the second run's values", async () => {
    await withTestRun(async ({ label, codes, csvWith }) => {
      const firstCsv = csvWith("100", "200");
      const secondCsv = csvWith("111", "222");

      const first = await importInto(firstCsv, label);
      const second = await importInto(secondCsv, label);

      const { data: runs } = await adminClient()
        .from("import_runs")
        .select("id, source, file_sha256, finished_at, row_count")
        .eq("label", label)
        .order("started_at");
      expect(runs).toHaveLength(2);
      expect(runs?.map((run) => run.id)).toEqual([first.runId, second.runId]);
      expect(runs?.map((run) => run.file_sha256)).toEqual([
        sha256Hex(firstCsv),
        sha256Hex(secondCsv),
      ]);
      expect(runs?.every((run) => run.source === "cofid" && run.row_count === 2)).toBe(true);
      expect(runs?.every((run) => run.finished_at !== null)).toBe(true);

      const foods = await readFoods(codes);
      expect(foods.map((food) => [food.source_ref, food.kcal])).toEqual([
        [codes[0], 111],
        [codes[1], 222],
      ]);

      const { data: sourceData } = await adminClient()
        .from("food_source_data")
        .select("food_id, import_run_id, raw")
        .in(
          "food_id",
          foods.map((food) => food.id),
        );
      expect(sourceData).toHaveLength(2);
      expect(sourceData?.every((row) => row.import_run_id === second.runId)).toBe(true);
      expect(sourceData?.map((row) => rawCell(row.raw, COFID_COLUMNS.kcal)).sort()).toEqual([
        "111",
        "222",
      ]);
    });
  });

  it("should store rows that parse as foods, with traces as 0 and alcoholic beverages per 100 ml", async () => {
    await withTestRun(async ({ label, codes, csvWith }) => {
      await importInto(csvWith("100", "200"), label);

      const [plain, beverage] = await readFoods(codes);

      expect(foodRowSchema.safeParse(plain).success).toBe(true);
      expect(foodRowSchema.safeParse(beverage).success).toBe(true);
      expect(plain).toMatchObject({
        source: "cofid",
        owner_id: null,
        fetched_at: null,
        basis: "per_100g",
      });
      expect(beverage).toMatchObject({
        basis: "per_100ml",
        protein_g: 0,
        salt_g: 0.6,
        micros: { vitamins_retinol_ug: 0 },
        quality: { trace_fields: ["protein_g", "vitamins_retinol_ug"] },
      });
    });
  });

  it("should write nothing for a dry run, not even an import run", async () => {
    await withTestRun(async ({ label, codes, csvWith }) => {
      const csv = csvWith("100", "200");

      await importCofid(createSupabaseImportStore(adminClient()), {
        csv,
        fileSha256: sha256Hex(csv),
        label,
        dryRun: true,
        batchSize: 100,
        log: () => undefined,
      });

      const { data: runs } = await adminClient()
        .from("import_runs")
        .select("id")
        .eq("label", label);
      expect(runs).toEqual([]);
      expect(await readFoods(codes)).toEqual([]);
    });
  });

  it("should leave a failed run unfinished with the rows it did write", async () => {
    await withTestRun(async ({ label, codes, csvWith }) => {
      const csv = csvWith("100", "200");
      const realStore = createSupabaseImportStore(adminClient());
      let batches = 0;
      const storeFailingOnSecondBatch: ImportStore = {
        ...realStore,
        writeBatch: (runId, batch) => {
          batches += 1;
          return batches === 2
            ? Promise.reject(new Error("The second batch failed"))
            : realStore.writeBatch(runId, batch);
        },
      };

      await expect(
        importCofid(storeFailingOnSecondBatch, {
          csv,
          fileSha256: sha256Hex(csv),
          label,
          dryRun: false,
          batchSize: 1,
          log: () => undefined,
        }),
      ).rejects.toThrow("The second batch failed");

      const { data: runs } = await adminClient()
        .from("import_runs")
        .select("finished_at, row_count")
        .eq("label", label);
      expect(runs).toEqual([{ finished_at: null, row_count: 1 }]);
      expect((await readFoods(codes)).map((food) => food.source_ref)).toEqual([codes[0]]);
    });
  });
});
