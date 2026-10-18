import { describe, expect, it } from "vitest";

import {
  createExerciseSeedStore,
  EXERCISE_SEED_RUN_ID,
} from "../../../scripts/exercises/exerciseSeedStore";
import { importExercises } from "../../../scripts/exercises/importExercises";
import { csvOfLifts, liftPerMuscle, sourceRowsOf } from "../../support/curatedCsv";

import type { TestLift } from "../../support/curatedCsv";

const sha256 = "a".repeat(64);
const sourceCommit = "c".repeat(40);

async function emit(lifts: readonly TestLift[], batchSize = 100): Promise<string> {
  const store = createExerciseSeedStore();
  await importExercises(store, {
    csv: csvOfLifts(lifts),
    sourceRows: sourceRowsOf(lifts),
    sourceCommit,
    fileSha256: sha256,
    label: "seed",
    dryRun: false,
    batchSize,
    log: () => undefined,
  });
  return store.render();
}

const lines = (sql: string, start: string): string[] =>
  sql.split("\n").filter((line) => line.startsWith(start));

describe("createExerciseSeedStore", () => {
  it("should wrap the file in one transaction, so every exercise meets the deferred primary-muscle check with its map", async () => {
    const sql = await emit(liftPerMuscle("seed"));

    const statements = sql.split("\n").filter((line) => !line.startsWith("--") && line !== "");
    expect(statements[0]).toBe("begin;");
    expect(statements[1]).toBe("set local standard_conforming_strings = on;");
    expect(statements.at(-1)).toBe("commit;");
    expect(sql.match(/^begin;$/gm)).toHaveLength(1);
    expect(sql.match(/^commit;$/gm)).toHaveLength(1);
  });

  it("should upsert one finished import run under the fixed id, before any exercise", async () => {
    const sql = await emit(liftPerMuscle("seed"));

    const [runInsert] = lines(sql, "insert into public.exercise_import_runs");
    expect(runInsert).toBe(
      `insert into public.exercise_import_runs (id, source, label, source_commit, file_sha256, started_at, finished_at, row_count) values ('${EXERCISE_SEED_RUN_ID}', 'free_exercise_db', 'seed', '${sourceCommit}', '${sha256}', now(), now(), 22) on conflict (id) do update set label = excluded.label, source_commit = excluded.source_commit, file_sha256 = excluded.file_sha256, finished_at = excluded.finished_at, row_count = excluded.row_count;`,
    );
    expect(lines(sql, "insert into public.exercise_import_runs")).toHaveLength(1);
    expect(sql.indexOf("insert into public.exercise_import_runs")).toBeLessThan(
      sql.indexOf("select public.import_exercises"),
    );
  });

  it("should write each exercise as one call of import_exercises, the function the import itself uses", async () => {
    const lifts = liftPerMuscle("seed");

    const sql = await emit(lifts, 5);

    const calls = lines(sql, "select public.import_exercises(");
    expect(calls).toHaveLength(22);
    const [first] = calls;
    expect(first).toMatch(
      new RegExp(
        `^select public\\.import_exercises\\('${EXERCISE_SEED_RUN_ID}', '\\[\\{.*\\}\\]'::jsonb\\);$`,
      ),
    );
    expect(first).toContain('"source_ref":"seed-abs"');
    expect(first).toContain('"muscles":[{"muscle_id":"abs","role":"primary","weight":1}]');
    expect(first).toContain('"raw":{"id":"seed-abs","name":"seed abs"}');
  });

  it("should order the exercises by source_ref, whatever order they arrive in", async () => {
    const lifts = liftPerMuscle("seed");

    const sql = await emit([...lifts].reverse());

    const refs = lines(sql, "select public.import_exercises(").map(
      (line) => /"source_ref":"([^"]+)"/.exec(line)?.[1],
    );
    expect(refs).toEqual([...refs].sort());
    expect(refs).toHaveLength(22);
  });

  it("should give the same text for the same exercises, with nothing from the clock or the machine", async () => {
    const lifts = liftPerMuscle("seed");

    expect(await emit(lifts)).toBe(await emit(lifts, 3));
  });

  it("should double a quote in a name and leave a backslash alone", async () => {
    const lifts = liftPerMuscle("seed").map((lift) =>
      lift.sourceRef === "seed-abs" ? { ...lift, name: "Farmer's walk \\ carry" } : lift,
    );

    const sql = await emit(lifts);

    expect(sql).toContain(`"name":"Farmer''s walk \\\\ carry"`);
  });

  it("should write a character outside ASCII as a JSON escape, so the file is plain ASCII and the stored text is the same", async () => {
    const lifts = liftPerMuscle("seed").map((lift) =>
      lift.sourceRef === "seed-abs"
        ? { ...lift, name: "Crunch \u2014 slow \u00e9 \u{1f600}" }
        : lift,
    );

    const sql = await emit(lifts);

    expect(sql).toContain('"name":"Crunch \\u2014 slow \\u00e9 \\ud83d\\ude00"');
    expect(sql).toMatch(/^[\n -~]*$/);
  });

  it("should refuse to render a run that was never finished", () => {
    expect(() => createExerciseSeedStore().render()).toThrow(
      "The import run is not finished, so there is no seed to write",
    );
  });

  it("should leave nothing to soft delete, because a seed is applied to a database with no exercises", async () => {
    const store = createExerciseSeedStore();

    await expect(store.listLiveSourceRefs()).resolves.toEqual([]);
  });
});
