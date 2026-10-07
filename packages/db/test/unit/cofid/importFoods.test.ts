import { describe, expect, it } from "vitest";

import { formatCsv } from "../../../scripts/cofid/csv";
import { importCofid } from "../../../scripts/cofid/importFoods";
import { COFID_COLUMNS, cofidRow } from "../../support/cofidRow";

import type { ImportStore } from "../../../scripts/cofid/importFoods";

type Call =
  | { call: "startRun"; label: string; fileSha256: string }
  | { call: "writeBatch"; runId: string; codes: string[]; raws: Record<string, string | null>[] }
  | { call: "finishRun"; runId: string; rowCount: number }
  | { call: "recordRowCount"; runId: string; rowCount: number };

/** An in-memory store that records what the import asks of it. */
function recordingStore(options: { failOnBatch?: number } = {}): {
  store: ImportStore;
  calls: Call[];
} {
  const calls: Call[] = [];
  let batches = 0;
  const store: ImportStore = {
    startRun: ({ label, fileSha256 }) => {
      calls.push({ call: "startRun", label, fileSha256 });
      return Promise.resolve("run-1");
    },
    writeBatch: (runId, batch) => {
      batches += 1;
      if (batches === options.failOnBatch) {
        return Promise.reject(new Error("The database refused the batch"));
      }
      calls.push({
        call: "writeBatch",
        runId,
        codes: batch.map(({ sourceRef }) => sourceRef),
        raws: batch.map(({ raw }) => raw),
      });
      return Promise.resolve();
    },
    finishRun: (runId, { rowCount }) => {
      calls.push({ call: "finishRun", runId, rowCount });
      return Promise.resolve();
    },
    recordRowCount: (runId, { rowCount }) => {
      calls.push({ call: "recordRowCount", runId, rowCount });
      return Promise.resolve();
    },
  };
  return { store, calls };
}

const codesWritten = (calls: readonly Call[]): string[][] =>
  calls.flatMap((entry) => (entry.call === "writeBatch" ? [entry.codes] : []));

const header = Object.keys(cofidRow());
const csvOf = (...rows: Record<string, string>[]): string =>
  formatCsv([header, ...rows.map((row) => header.map((name) => row[name] ?? ""))]);
const food = (code: string, overrides: Record<string, string> = {}) =>
  cofidRow({ food_code: code, food_name: `Food ${code}`, ...overrides });

const baseOptions = {
  label: "unit-test",
  fileSha256: "a".repeat(64),
  dryRun: false,
  batchSize: 100,
  log: () => undefined,
};

describe("importCofid", () => {
  it("should record the run, write the foods, then finish the run with the count", async () => {
    const { store, calls } = recordingStore();

    const summary = await importCofid(store, {
      ...baseOptions,
      csv: csvOf(food("11-1"), food("11-2")),
    });

    expect(summary).toMatchObject({ runId: "run-1", rowCount: 2, skippedDuplicateCodes: [] });
    expect(calls.map((entry) => entry.call)).toEqual(["startRun", "writeBatch", "finishRun"]);
    expect(calls[0]).toEqual({ call: "startRun", label: "unit-test", fileSha256: "a".repeat(64) });
    expect(calls[2]).toEqual({ call: "finishRun", runId: "run-1", rowCount: 2 });
  });

  it("should hand the store the run id and each food's whole source row", async () => {
    const { store, calls } = recordingStore();

    await importCofid(store, {
      ...baseOptions,
      csv: csvOf(food("11-1", { [COFID_COLUMNS.carbs]: "Tr" })),
    });

    const batch = calls.find((entry) => entry.call === "writeBatch");
    expect(batch).toMatchObject({
      runId: "run-1",
      codes: ["11-1"],
      raws: [{ food_code: "11-1", [COFID_COLUMNS.carbs]: "Tr" }],
    });
  });

  it("should write in batches of the given size", async () => {
    const { store, calls } = recordingStore();

    await importCofid(store, {
      ...baseOptions,
      batchSize: 2,
      csv: csvOf(food("11-1"), food("11-2"), food("11-3"), food("11-4"), food("11-5")),
    });

    expect(codesWritten(calls)).toEqual([["11-1", "11-2"], ["11-3", "11-4"], ["11-5"]]);
  });

  it("should log the progress after every batch and the total at the end", async () => {
    const { store } = recordingStore();
    const messages: string[] = [];

    await importCofid(store, {
      ...baseOptions,
      batchSize: 2,
      log: (message) => messages.push(message),
      csv: csvOf(food("11-1"), food("11-2"), food("11-3")),
    });

    expect(messages).toEqual(
      expect.arrayContaining(["Imported 2 of 3 foods", "Imported 3 of 3 foods"]),
    );
  });

  describe("--dry-run", () => {
    it("should map and count everything and touch nothing", async () => {
      const { store, calls } = recordingStore();

      const summary = await importCofid(store, {
        ...baseOptions,
        dryRun: true,
        csv: csvOf(food("11-1"), food("11-2")),
      });

      expect(calls).toEqual([]);
      expect(summary).toMatchObject({ rowCount: 2, runId: undefined });
    });

    it("should still refuse a row it cannot map", async () => {
      const { store } = recordingStore();

      await expect(
        importCofid(store, {
          ...baseOptions,
          dryRun: true,
          csv: csvOf(food("11-1", { [COFID_COLUMNS.protein]: "0.5-1" })),
        }),
      ).rejects.toThrow("0.5-1");
    });
  });

  describe("rows it cannot map", () => {
    it("should write nothing and report how many rows failed and why", async () => {
      const { store, calls } = recordingStore();

      await expect(
        importCofid(store, {
          ...baseOptions,
          csv: csvOf(
            food("11-1"),
            food("11-2", { [COFID_COLUMNS.protein]: "0.5-1" }),
            food("11-3", { [COFID_COLUMNS.fat]: "<0.1" }),
          ),
        }),
      ).rejects.toThrow(/2 of 3 rows.*11-2.*0\.5-1.*11-3.*<0\.1/s);
      expect(calls).toEqual([]);
    });

    it("should name the missing columns when the header is not a CoFID CSV", async () => {
      const { store } = recordingStore();

      await expect(
        importCofid(store, { ...baseOptions, csv: "food_code,food_name\n11-1,Bread\n" }),
      ).rejects.toThrow(COFID_COLUMNS.kcal);
    });

    it("should refuse a row with a different number of fields from the header", async () => {
      const { store } = recordingStore();

      await expect(
        importCofid(store, { ...baseOptions, csv: `${csvOf(food("11-1"))}11-2,Bread\n` }),
      ).rejects.toThrow("row 3");
    });
  });

  describe("codes that appear more than once", () => {
    it("should skip every food with such a code, say so, and import the rest", async () => {
      const { store, calls } = recordingStore();
      const messages: string[] = [];

      const summary = await importCofid(store, {
        ...baseOptions,
        log: (message) => messages.push(message),
        csv: csvOf(food("13-669"), food("11-1"), food("13-669", { food_name: "Another food" })),
      });

      expect(summary).toMatchObject({ rowCount: 1, skippedDuplicateCodes: ["13-669"] });
      expect(codesWritten(calls)).toEqual([["11-1"]]);
      expect(messages.join("\n")).toContain("13-669");
    });
  });

  describe("--subset", () => {
    it("should import only the listed codes", async () => {
      const { store, calls } = recordingStore();

      const summary = await importCofid(store, {
        ...baseOptions,
        subsetCodes: ["11-2", "11-3"],
        csv: csvOf(food("11-1"), food("11-2"), food("11-3")),
      });

      expect(summary.rowCount).toBe(2);
      expect(codesWritten(calls)).toEqual([["11-2", "11-3"]]);
    });

    it("should refuse codes that are not in the CSV, listing every one, before writing anything", async () => {
      const { store, calls } = recordingStore();

      await expect(
        importCofid(store, {
          ...baseOptions,
          subsetCodes: ["11-1", "99-1", "99-2"],
          csv: csvOf(food("11-1")),
        }),
      ).rejects.toThrow("99-1, 99-2");
      expect(calls).toEqual([]);
    });

    it("should refuse a code that was skipped for appearing twice", async () => {
      const { store } = recordingStore();

      await expect(
        importCofid(store, {
          ...baseOptions,
          subsetCodes: ["13-669"],
          csv: csvOf(food("13-669"), food("13-669", { food_name: "Another food" })),
        }),
      ).rejects.toThrow("13-669");
    });
  });

  describe("when a batch fails", () => {
    it("should keep the rows written on the run, leave it unfinished, stop, and report the failure", async () => {
      const { store, calls } = recordingStore({ failOnBatch: 2 });

      await expect(
        importCofid(store, {
          ...baseOptions,
          batchSize: 2,
          csv: csvOf(food("11-1"), food("11-2"), food("11-3"), food("11-4"), food("11-5")),
        }),
      ).rejects.toThrow("The database refused the batch");

      expect(codesWritten(calls)).toEqual([["11-1", "11-2"]]);
      expect(calls.at(-1)).toEqual({ call: "recordRowCount", runId: "run-1", rowCount: 2 });
      expect(calls.some((entry) => entry.call === "finishRun")).toBe(false);
    });
  });

  describe("the label", () => {
    it.each(["", "   "])(
      "should refuse the empty label %j before touching anything",
      async (label) => {
        const { store, calls } = recordingStore();

        await expect(
          importCofid(store, { ...baseOptions, label, csv: csvOf(food("11-1")) }),
        ).rejects.toThrow("The label must not be empty");
        expect(calls).toEqual([]);
      },
    );
  });
});
