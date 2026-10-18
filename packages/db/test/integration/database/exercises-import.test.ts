import { describe, expect, it } from "vitest";

import { importExercises } from "../../../scripts/exercises/importExercises";
import { createSupabaseExerciseStore } from "../../../scripts/exercises/supabaseExerciseStore";
import { csvOfLifts, liftPerMuscle, sourceRowsOf } from "../../support/curatedCsv";
import { adminClient } from "../support/stack";

import type { ImportMuscle, ImportRow } from "../../../scripts/exercises/importExercise";
import type { ExerciseImportStore } from "../../../scripts/exercises/importExercises";
import type { TestLift } from "../../support/curatedCsv";

// Every row these tests make is labelled key349-: the run's label, and the source_ref of each exercise
// (key349-<tag>-<muscle>). The service role cannot delete exercises or runs, so a test ends by soft
// deleting its exercises, which leaves them out of every live count, and leaves its rows behind.

type TestLibrary = {
  label: string;
  /** The start of every source_ref of this test's exercises. */
  prefix: string;
  lifts: TestLift[];
  /** One more exercise (a second abs lift), for the tests that remove one. */
  extra: TestLift;
  /** The lifts and the extra exercise. */
  liftsWithExtra: TestLift[];
  store: ExerciseImportStore;
  /** Imports this library, or the given lifts, as a finished run. */
  importLifts: (
    lifts: readonly TestLift[],
    options?: { dryRun?: boolean; batchSize?: number; store?: ExerciseImportStore },
  ) => ReturnType<typeof importExercises>;
};

/**
 * Gives the test its own label and source references, and soft deletes every exercise it made
 * afterwards, whether the test passed or not. The store only sees this test's exercises when it
 * decides what the CSV removed, so a test never touches the real library or another test's rows.
 */
async function withTestLibrary(body: (library: TestLibrary) => Promise<void>): Promise<void> {
  const tag = crypto.randomUUID();
  const prefix = `key349-${tag}`;
  const label = `key349-${tag}`;
  const lifts = liftPerMuscle(prefix);
  const extra: TestLift = {
    sourceRef: `${prefix}-extra`,
    name: `${prefix} extra`,
    muscles: "abs:primary:1.0",
  };
  const liftsWithExtra = [...lifts, extra];

  const realStore = createSupabaseExerciseStore(adminClient());
  const store: ExerciseImportStore = {
    ...realStore,
    listLiveSourceRefs: async () =>
      (await realStore.listLiveSourceRefs()).filter((sourceRef) => sourceRef.startsWith(prefix)),
  };

  const importLifts: TestLibrary["importLifts"] = (importedLifts, options = {}) =>
    importExercises(options.store ?? store, {
      csv: csvOfLifts(importedLifts),
      sourceRows: sourceRowsOf(importedLifts),
      sourceCommit: "key349-commit",
      fileSha256: "a".repeat(64),
      label,
      dryRun: options.dryRun ?? false,
      batchSize: options.batchSize ?? 100,
      log: () => undefined,
    });

  try {
    await body({ label, prefix, lifts, extra, liftsWithExtra, store, importLifts });
  } finally {
    await store.softDelete(liftsWithExtra.map(({ sourceRef }) => sourceRef));
  }
}

async function readExercises(lifts: readonly TestLift[]) {
  const { data, error } = await adminClient()
    .from("exercises")
    .select("id, source, source_ref, owner_id, name, equipment, mechanic, deleted_at")
    .in(
      "source_ref",
      lifts.map(({ sourceRef }) => sourceRef),
    )
    .order("source_ref");
  if (error) {
    throw new Error("Could not read the test exercises", { cause: error });
  }
  return data;
}

/** The map rows of the lifts, in a fixed order, with their own ids, so a test can tell a rewritten row from a kept one. */
async function readMaps(lifts: readonly TestLift[]) {
  const exercises = await readExercises(lifts);
  const { data, error } = await adminClient()
    .from("exercise_muscles")
    .select("id, exercise_id, owner_id, muscle_id, role, weight")
    .in(
      "exercise_id",
      exercises.map(({ id }) => id),
    )
    .order("exercise_id")
    .order("muscle_id");
  if (error) {
    throw new Error("Could not read the test maps", { cause: error });
  }
  return data.map((row) => ({
    ...row,
    sourceRef: exercises.find(({ id }) => id === row.exercise_id)?.source_ref,
  }));
}

async function readRuns(label: string) {
  const { data, error } = await adminClient()
    .from("exercise_import_runs")
    .select("id, source, source_commit, file_sha256, finished_at, row_count")
    .eq("label", label)
    .order("started_at");
  if (error) {
    throw new Error("Could not read the test runs", { cause: error });
  }
  return data;
}

describe("the exercise import", () => {
  it("should write the exercises, their maps and one source row each, under one finished run", async () => {
    await withTestLibrary(async ({ label, lifts, importLifts }) => {
      const summary = await importLifts(lifts);

      expect(summary).toMatchObject({ rowCount: 22, created: 22, updated: 0, unchanged: 0 });
      const [run] = await readRuns(label);
      expect(run).toMatchObject({
        id: summary.runId,
        source: "free_exercise_db",
        source_commit: "key349-commit",
        file_sha256: "a".repeat(64),
        row_count: 22,
      });
      expect(run?.finished_at).not.toBeNull();

      const exercises = await readExercises(lifts);
      expect(exercises).toHaveLength(22);
      expect(
        exercises.every(
          ({ source, owner_id, deleted_at }) =>
            source === "free_exercise_db" && owner_id === null && deleted_at === null,
        ),
      ).toBe(true);

      const maps = await readMaps(lifts);
      expect(maps).toHaveLength(22);
      expect(
        maps.every(
          ({ role, weight, owner_id }) => role === "primary" && weight === 1 && owner_id === null,
        ),
      ).toBe(true);

      const { data: sourceRows } = await adminClient()
        .from("exercise_source_data")
        .select("exercise_id, import_run_id, raw")
        .in(
          "exercise_id",
          exercises.map(({ id }) => id),
        );
      expect(sourceRows).toHaveLength(22);
      expect(sourceRows?.every(({ import_run_id }) => import_run_id === summary.runId)).toBe(true);
      expect(sourceRows?.map(({ raw }) => raw)).toEqual(
        expect.arrayContaining(lifts.map(({ sourceRef, name }) => ({ id: sourceRef, name }))),
      );
    });
  });

  it("should leave the same rows when the same CSV is imported again, with a run and a source row of its own", async () => {
    await withTestLibrary(async ({ label, lifts, importLifts }) => {
      const first = await importLifts(lifts);
      const exercisesBefore = await readExercises(lifts);
      const mapsBefore = await readMaps(lifts);

      const second = await importLifts(lifts);

      expect(second).toMatchObject({ rowCount: 22, created: 0, updated: 0, unchanged: 22 });
      expect(await readExercises(lifts)).toEqual(exercisesBefore);
      expect(await readMaps(lifts)).toEqual(mapsBefore);

      const runs = await readRuns(label);
      expect(runs.map(({ id }) => id)).toEqual([first.runId, second.runId]);
      const { data: sourceRows } = await adminClient()
        .from("exercise_source_data")
        .select("import_run_id")
        .in(
          "exercise_id",
          exercisesBefore.map(({ id }) => id),
        );
      expect(sourceRows).toHaveLength(22);
      expect(sourceRows?.every(({ import_run_id }) => import_run_id === second.runId)).toBe(true);
    });
  });

  it("should replace the map of the one exercise whose weight changed and no other", async () => {
    await withTestLibrary(async ({ prefix, lifts, importLifts }) => {
      const benchRef = `${prefix}-chest_upper`;
      const withTricepsWeight = (weight: number): TestLift[] =>
        lifts.map((lift) =>
          lift.sourceRef === benchRef
            ? { ...lift, muscles: `chest_upper:primary:1.0;triceps:secondary:${weight}` }
            : lift,
        );
      await importLifts(withTricepsWeight(0.5));
      const mapsBefore = await readMaps(lifts);

      const summary = await importLifts(withTricepsWeight(0.7));

      expect(summary).toMatchObject({ created: 0, updated: 1, unchanged: 21 });
      const mapsAfter = await readMaps(lifts);
      const ofBench = (maps: typeof mapsAfter) =>
        maps.filter(({ sourceRef }) => sourceRef === benchRef);
      const ofOthers = (maps: typeof mapsAfter) =>
        maps.filter(({ sourceRef }) => sourceRef !== benchRef);

      expect(ofOthers(mapsAfter)).toEqual(ofOthers(mapsBefore));
      expect(ofBench(mapsAfter).map(({ muscle_id, weight }) => [muscle_id, weight])).toEqual([
        ["chest_upper", 1],
        ["triceps", 0.7],
      ]);
      const idsBefore = ofBench(mapsBefore).map(({ id }) => id);
      expect(ofBench(mapsAfter).some(({ id }) => idsBefore.includes(id))).toBe(false);
    });
  });

  it("should soft delete an exercise the CSV no longer has, keep its row and map, and bring it back when it returns", async () => {
    await withTestLibrary(async ({ lifts, extra, liftsWithExtra, importLifts }) => {
      await importLifts(liftsWithExtra);

      const removal = await importLifts(lifts);

      expect(removal).toMatchObject({ rowCount: 22, unchanged: 22, softDeleted: 1 });
      const [removed] = await readExercises([extra]);
      expect(removed?.deleted_at).not.toBeNull();
      expect(await readMaps([extra])).toHaveLength(1);
      expect((await readExercises(lifts)).every(({ deleted_at }) => deleted_at === null)).toBe(
        true,
      );

      const again = await importLifts(liftsWithExtra);

      expect(again).toMatchObject({ rowCount: 23, updated: 1, unchanged: 22, softDeleted: 0 });
      expect((await readExercises([extra]))[0]?.deleted_at).toBeNull();
    });
  });

  it("should write nothing on a dry run, not even an import run", async () => {
    await withTestLibrary(async ({ label, lifts, importLifts }) => {
      const summary = await importLifts(lifts, { dryRun: true });

      expect(summary).toMatchObject({ runId: undefined, rowCount: 22 });
      expect(await readRuns(label)).toEqual([]);
      expect(await readExercises(lifts)).toEqual([]);
    });
  });

  it("should leave a failed run unfinished, with the exercises it did write", async () => {
    await withTestLibrary(async ({ label, lifts, store, importLifts }) => {
      let batches = 0;
      const storeFailingOnSecondBatch: ExerciseImportStore = {
        ...store,
        writeBatch: (runId, batch) => {
          batches += 1;
          return batches === 2
            ? Promise.reject(new Error("The second batch failed"))
            : store.writeBatch(runId, batch);
        },
      };

      await expect(
        importLifts(lifts, { batchSize: 10, store: storeFailingOnSecondBatch }),
      ).rejects.toThrow("The second batch failed");

      const [run] = await readRuns(label);
      expect(run?.finished_at).toBeNull();
      expect(run?.row_count).toBe(10);
      expect(await readExercises(lifts)).toHaveLength(10);
    });
  });

  describe("a batch the database refuses", () => {
    const row = (sourceRef: string, name: string, muscles: ImportMuscle[]): ImportRow => ({
      sourceRef,
      name,
      equipment: "barbell",
      mechanic: "compound",
      muscles,
      raw: {},
    });

    const refusalOf = async (store: ExerciseImportStore, batch: ImportRow[]): Promise<string> => {
      const runId = await store.startRun({
        label: "key349-refused",
        sourceCommit: "key349-commit",
        fileSha256: "a".repeat(64),
      });
      const failure = await store.writeBatch(runId, batch).then(
        () => undefined,
        (error: unknown) => error,
      );
      return failure instanceof Error ? failure.message : "";
    };

    it("should commit nothing of a batch that holds an exercise with no primary muscle", async () => {
      await withTestLibrary(async ({ prefix, lifts, store }) => {
        const message = await refusalOf(store, [
          row(`${prefix}-abs`, `${prefix} abs`, [{ muscleId: "abs", role: "primary", weight: 1 }]),
          row(`${prefix}-forearms`, `${prefix} forearms`, [
            { muscleId: "forearms", role: "secondary", weight: 0.5 },
          ]),
        ]);

        expect(message).toContain("23514");
        expect(await readExercises(lifts)).toEqual([]);
      });
    });

    it("should say only the database error code, because the database quotes the failing row", async () => {
      await withTestLibrary(async ({ prefix, store }) => {
        // A name over 200 characters fails a check constraint, and the error's detail holds the whole row.
        const secretName = `key349-secret-name-${crypto.randomUUID()}-${"x".repeat(200)}`;

        const message = await refusalOf(store, [
          row(`${prefix}-abs`, secretName, [{ muscleId: "abs", role: "primary", weight: 1 }]),
        ]);

        expect(message).toContain("23514");
        expect(message).not.toContain("key349-secret-name");
        expect(message).not.toContain(prefix);
      });
    });
  });
});
