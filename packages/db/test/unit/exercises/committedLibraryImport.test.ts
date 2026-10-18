import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { parseCsv } from "../../../scripts/cofid/csv";
import {
  readExerciseLibrary,
  renderExerciseSeed,
} from "../../../scripts/exercises/exerciseLibrary";
import { EXERCISE_SEED_FILE, SOURCE_COMMIT } from "../../../scripts/exercises/files";
import { importExercises } from "../../../scripts/exercises/importExercises";
import { readCuratedExercises } from "../../../scripts/exercises/readCuratedExercises";

import type { ExerciseImportStore } from "../../../scripts/exercises/importExercises";

const packageDirectory = fileURLToPath(new URL("../../..", import.meta.url));
const library = readExerciseLibrary(packageDirectory);

const readPackageFile = (path: string): string =>
  readFileSync(new URL(`../../../${path}`, import.meta.url), "utf8");

/** A store that fails the test if the import writes to it. */
const storeThatMustNotBeUsed: ExerciseImportStore = {
  startRun: () => Promise.reject(new Error("A dry run must not write")),
  writeBatch: () => Promise.reject(new Error("A dry run must not write")),
  listLiveSourceRefs: () => Promise.reject(new Error("A dry run must not read")),
  softDelete: () => Promise.reject(new Error("A dry run must not write")),
  finishRun: () => Promise.reject(new Error("A dry run must not write")),
  recordRowCount: () => Promise.reject(new Error("A dry run must not write")),
};

describe("the committed exercise library, imported", () => {
  it("should pass a dry run with every row valid and write nothing", async () => {
    const rowCount = parseCsv(library.csv).length - 1;
    expect(rowCount).toBeGreaterThan(600);

    const summary = await importExercises(storeThatMustNotBeUsed, {
      ...library,
      sourceCommit: SOURCE_COMMIT,
      label: "dry-run",
      dryRun: true,
      batchSize: 100,
      log: () => undefined,
    });

    expect(summary).toMatchObject({ runId: undefined, rowCount });
  });

  it("should have a source row for every curated exercise, holding the entry as the source file has it", () => {
    for (const { sourceRef, name } of readCuratedExercises(library.csv)) {
      const raw = library.sourceRows.get(sourceRef);
      expect(raw, "a curated exercise has no source row").toMatchObject({ id: sourceRef });
      expect(raw, "a curated exercise's source row has another name").toMatchObject({ name });
    }
  });

  it("should record in VERIFICATION.md the commit the source file is taken from", () => {
    expect(readPackageFile("data/exercises/VERIFICATION.md")).toContain(SOURCE_COMMIT);
  });

  it("should be what 40_exercises.sql holds, so the seed cannot drift from the CSV", async () => {
    // Compared as a boolean so a mismatch does not print two long strings.
    const isUpToDate =
      (await renderExerciseSeed(library, "seed")) === readPackageFile(EXERCISE_SEED_FILE);
    expect(isUpToDate, "run the regeneration command in docs/runbooks/local-dev.md").toBe(true);
  });
});
