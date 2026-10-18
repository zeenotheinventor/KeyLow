import { describe, expect, it } from "vitest";

import { importExercises } from "../../../scripts/exercises/importExercises";
import { csvOfLifts, liftPerMuscle } from "../../support/curatedCsv";

import type { ExerciseImportStore } from "../../../scripts/exercises/importExercises";
import type { Json } from "../../../src/types.gen";

type Call =
  | { call: "startRun"; label: string; sourceCommit: string; fileSha256: string }
  | { call: "writeBatch"; runId: string; sourceRefs: string[]; raws: Json[] }
  | { call: "listLiveSourceRefs" }
  | { call: "softDelete"; sourceRefs: string[] }
  | { call: "finishRun"; runId: string; rowCount: number }
  | { call: "recordRowCount"; runId: string; rowCount: number };

/** An in-memory store that records what the import asks of it. */
function recordingStore(
  options: { liveSourceRefs?: string[]; failOnBatch?: number; createdPerBatch?: number } = {},
): { store: ExerciseImportStore; calls: Call[] } {
  const calls: Call[] = [];
  let batches = 0;
  const store: ExerciseImportStore = {
    startRun: ({ label, sourceCommit, fileSha256 }) => {
      calls.push({ call: "startRun", label, sourceCommit, fileSha256 });
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
        sourceRefs: batch.map(({ sourceRef }) => sourceRef),
        raws: batch.map(({ raw }) => raw),
      });
      const created = Math.min(options.createdPerBatch ?? 0, batch.length);
      return Promise.resolve({ created, updated: 0, unchanged: batch.length - created });
    },
    listLiveSourceRefs: () => {
      calls.push({ call: "listLiveSourceRefs" });
      return Promise.resolve(options.liveSourceRefs ?? []);
    },
    softDelete: (sourceRefs) => {
      calls.push({ call: "softDelete", sourceRefs: [...sourceRefs] });
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

const lifts = liftPerMuscle("Lift");
const refs = lifts.map(({ sourceRef }) => sourceRef);
const csv = csvOfLifts(lifts);
const sourceRows = new Map<string, Json>(
  refs.map((ref) => [ref, { id: ref, name: `Source row of ${ref}` }]),
);

const baseOptions = {
  csv,
  sourceRows,
  sourceCommit: "c".repeat(40),
  fileSha256: "a".repeat(64),
  label: "unit-test",
  dryRun: false,
  batchSize: 100,
  log: () => undefined,
};

describe("importExercises", () => {
  it("should record the run, write the exercises with their source rows, then finish the run", async () => {
    const { store, calls } = recordingStore({ createdPerBatch: 22 });

    const summary = await importExercises(store, baseOptions);

    expect(calls.map((entry) => entry.call)).toEqual([
      "startRun",
      "writeBatch",
      "listLiveSourceRefs",
      "finishRun",
    ]);
    expect(calls[0]).toEqual({
      call: "startRun",
      label: "unit-test",
      sourceCommit: "c".repeat(40),
      fileSha256: "a".repeat(64),
    });
    expect(calls[1]).toMatchObject({ runId: "run-1", sourceRefs: refs });
    expect(calls[1]).toMatchObject({
      raws: refs.map((ref) => ({ id: ref, name: `Source row of ${ref}` })),
    });
    expect(calls[3]).toEqual({ call: "finishRun", runId: "run-1", rowCount: 22 });
    expect(summary).toEqual({
      runId: "run-1",
      rowCount: 22,
      created: 22,
      updated: 0,
      unchanged: 0,
      softDeleted: 0,
    });
  });

  it("should write in batches of the given size and add up what each batch changed", async () => {
    const { store, calls } = recordingStore({ createdPerBatch: 1 });

    const summary = await importExercises(store, { ...baseOptions, batchSize: 10 });

    const batches = calls.flatMap((entry) => (entry.call === "writeBatch" ? [entry] : []));
    expect(batches.map(({ sourceRefs }) => sourceRefs.length)).toEqual([10, 10, 2]);
    expect(summary).toMatchObject({ rowCount: 22, created: 3, unchanged: 19 });
  });

  it("should soft delete the live exercises that the CSV no longer has, and only those", async () => {
    const { store, calls } = recordingStore({
      liveSourceRefs: [...refs, "Gone_One", "Gone_Two"],
    });

    const summary = await importExercises(store, baseOptions);

    expect(
      calls.flatMap((entry) => (entry.call === "softDelete" ? [entry.sourceRefs] : [])),
    ).toEqual([["Gone_One", "Gone_Two"]]);
    expect(calls.map((entry) => entry.call).slice(-2)).toEqual(["softDelete", "finishRun"]);
    expect(summary.softDeleted).toBe(2);
  });

  it("should not ask for a soft delete when nothing was removed", async () => {
    const { store, calls } = recordingStore({ liveSourceRefs: refs });

    await importExercises(store, baseOptions);

    expect(calls.some((entry) => entry.call === "softDelete")).toBe(false);
  });

  it("should map and check every row and write nothing on a dry run", async () => {
    const { store, calls } = recordingStore();
    const lines: string[] = [];

    const summary = await importExercises(store, {
      ...baseOptions,
      dryRun: true,
      log: (line) => lines.push(line),
    });

    expect(calls).toEqual([]);
    expect(summary).toEqual({
      runId: undefined,
      rowCount: 22,
      created: 0,
      updated: 0,
      unchanged: 0,
      softDeleted: 0,
    });
    expect(lines).toEqual(["Dry run: 22 exercises mapped and checked, nothing written"]);
  });

  it("should refuse a curated exercise that has no row in the source file, on a dry run too", async () => {
    const missing = new Map(sourceRows);
    missing.delete("Lift-neck");

    for (const dryRun of [true, false]) {
      const { store, calls } = recordingStore();

      await expect(
        importExercises(store, { ...baseOptions, sourceRows: missing, dryRun }),
      ).rejects.toThrow(
        "1 curated exercises have no row in the source file, so nothing was written",
      );
      expect(calls).toEqual([]);
    }
  });

  it("should refuse a CSV the checker fails, before the store is touched", async () => {
    const { store, calls } = recordingStore();

    await expect(
      importExercises(store, {
        ...baseOptions,
        csv: csv.replace("neck:primary", "neck:secondary"),
      }),
    ).rejects.toThrow("The curated CSV fails 2 checks");
    expect(calls).toEqual([]);
  });

  it("should refuse an empty label", async () => {
    const { store, calls } = recordingStore();

    await expect(importExercises(store, { ...baseOptions, label: "  " })).rejects.toThrow(
      "The label must not be empty",
    );
    expect(calls).toEqual([]);
  });

  it("should keep the count written when a batch fails, leave the run unfinished and remove nothing", async () => {
    const { store, calls } = recordingStore({ failOnBatch: 2, liveSourceRefs: [...refs, "Gone"] });

    await expect(importExercises(store, { ...baseOptions, batchSize: 10 })).rejects.toThrow(
      "The database refused the batch",
    );

    expect(calls.at(-1)).toEqual({ call: "recordRowCount", runId: "run-1", rowCount: 10 });
    expect(calls.some((entry) => ["finishRun", "softDelete"].includes(entry.call))).toBe(false);
  });

  it("should write no exercise name or source reference to the log", async () => {
    const { store } = recordingStore({ liveSourceRefs: [...refs, "Gone_One"] });
    const lines: string[] = [];

    await importExercises(store, {
      ...baseOptions,
      batchSize: 10,
      log: (line) => lines.push(line),
    });
    await importExercises(recordingStore({ failOnBatch: 1 }).store, {
      ...baseOptions,
      log: (line) => lines.push(line),
    }).catch(() => undefined);

    expect(lines.length).toBeGreaterThan(0);
    expect(lines.join("\n")).not.toMatch(/Lift|Gone|chest|lats/i);
  });
});
