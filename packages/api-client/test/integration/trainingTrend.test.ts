// @vitest-environment jsdom
// The hooks need a DOM to render in. The rest of the integration suite runs in node.
import { exerciseWeeklyTrend, routineTrendsByDay } from "@keylow/core/training";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  dayIdsOf,
  findGlobalExercise,
  logSets,
  present,
  saveExercise,
  saveRoutine,
  softDeleteSession,
  softDeleteSet,
  startSession,
} from "./support/training";
import { createTestUser, deleteCreatedTestUsers } from "./support/users";
import { useExerciseTrendSets } from "../../src/hooks/useExerciseTrendSets";
import { useRoutineTrendSets } from "../../src/hooks/useRoutineTrendSets";
import { listTrendSets } from "../../src/repos/trainingTrend";
import { refreshSessions } from "../../src/sessionCache";
import { createWrapper } from "../support/wrapper";

import type { SavedExercise } from "./support/training";
import type { TestUser } from "./support/users";

// The weekly exercise trend's reads over the real tables with real user JWTs. The profile's time zone is
// UTC (the column's default). The bench is a live library exercise (every user can log against it) and
// the row is the user's own. Every row written here is the test user's own, and every assertion is about
// those rows.

const NOW = "2026-10-20T12:00:00Z";
const RANGE = { fromWeek: "2026-09-28", throughDay: "2026-10-20" };

let owner: TestUser;
let stranger: TestUser;
let bench: SavedExercise;
let row: SavedExercise;
let routineId: string;

const SET = (performedAt: string, loadKg: number | null, reps: number, setType?: "warmup") => ({
  performedAt,
  loadKg,
  reps,
  ...(setType === undefined ? {} : { setType }),
});

beforeAll(async () => {
  [owner, stranger] = await Promise.all([createTestUser("key506"), createTestUser("key506")]);
  bench = await findGlobalExercise();
  row = await saveExercise(owner, "trend-row");
  routineId = await saveRoutine(owner, null, [
    { weekday: 0, name: "push", exerciseIds: [bench.id] },
    { weekday: null, name: "pull", exerciseIds: [row.id, bench.id] },
  ]);
  const [pushDayId] = await dayIdsOf(owner, routineId);

  // The golden bench: 60x8 (before the range), 60x10, 62.5x6, a skipped week, 60x8.
  const week1 = await startSession(owner, "2026-09-22", { routineDayId: pushDayId ?? null });
  await logSets(owner, week1, bench, [
    SET("2026-09-22T09:00:00Z", 100, 3, "warmup"),
    SET("2026-09-22T09:10:00Z", 60, 8),
  ]);
  const oldest = await startSession(owner, "2026-08-04");
  await logSets(owner, oldest, bench, [SET("2026-08-04T09:00:00Z", 40, 8)]);

  const week2 = await startSession(owner, "2026-09-29", { routineDayId: pushDayId ?? null });
  await logSets(owner, week2, bench, [SET("2026-09-29T09:00:00Z", 60, 10)]);

  // Another routine's session counts: this one is a free-standing routine day of nothing in particular.
  const week3 = await startSession(owner, "2026-10-06");
  const [deletedSet] = await logSets(owner, week3, bench, [
    SET("2026-10-06T09:00:00Z", 100, 5),
    SET("2026-10-06T09:10:00Z", 62.5, 6),
    SET("2026-10-06T09:20:00Z", 110, 2, "warmup"),
  ]);
  await softDeleteSet(owner, present(deletedSet, "the set to delete"));

  // A deleted session never counts, however heavy.
  const deleted = await startSession(owner, "2026-10-13");
  await logSets(owner, deleted, bench, [SET("2026-10-13T09:00:00Z", 120, 5)]);
  await softDeleteSession(owner, deleted);

  // A free session counts.
  const free = await startSession(owner, "2026-10-19");
  await logSets(owner, free, bench, [SET("2026-10-19T09:00:00Z", 60, 8)]);

  // The row is logged in an open session (it has not ended), which counts.
  const open = await startSession(owner, "2026-10-20", { endedAt: null });
  await logSets(owner, open, row, [SET("2026-10-20T09:00:00Z", 45, 10)]);

  const strangers = await startSession(stranger, "2026-10-20");
  await logSets(stranger, strangers, bench, [SET("2026-10-20T09:00:00Z", 150, 1)]);
});

afterEach(() => {
  cleanup();
});

afterAll(async () => {
  await deleteCreatedTestUsers();
});

const trendOf = (rows: Awaited<ReturnType<typeof listTrendSets>>) =>
  exerciseWeeklyTrend(rows.sets, { range: "4w", now: NOW, timeZone: "UTC", earlier: rows.earlier });

describe("listTrendSets over the real tables", () => {
  it("should give the golden bench: its heaviest working sets, the gap, and the changes against the last trained week", async () => {
    const rows = await listTrendSets(owner.client, [bench.id], RANGE);

    const { weeks } = trendOf(rows);

    expect(weeks.map(({ weekStart, value }) => [weekStart, value])).toEqual([
      ["2026-09-28", { loadKg: 60, reps: 10 }],
      ["2026-10-05", { loadKg: 62.5, reps: 6 }],
      ["2026-10-12", null],
      ["2026-10-19", { loadKg: 60, reps: 8 }],
    ]);
    expect(weeks.map(({ change }) => change)).toEqual([
      { kind: "reps", repsChange: 2 },
      { kind: "load", previousLoadKg: 60, latestLoadKg: 62.5, repsChange: -4 },
      null,
      { kind: "load", previousLoadKg: 62.5, latestLoadKg: 60, repsChange: 2 },
    ]);
  });

  it("should give the sets of the last trained week before the range, and no warm-up", async () => {
    const { sets, earlier } = await listTrendSets(owner.client, [bench.id], RANGE);

    expect(
      earlier.map(({ local_date, load_kg, set_type }) => [local_date, load_kg, set_type]),
    ).toEqual([["2026-09-22", 60, "working"]]);
    expect([...sets, ...earlier].some(({ set_type }) => set_type === "warmup")).toBe(false);
  });

  it("should leave out a deleted set, the sets of a deleted session, and another user's sets", async () => {
    const { sets } = await listTrendSets(owner.client, [bench.id], RANGE);

    const loads = sets.map(({ load_kg }) => load_kg);
    expect(loads).not.toContain(100);
    expect(loads).not.toContain(120);
    expect(loads).not.toContain(150);
  });

  it("should read the sets of every exercise of the routine together, and count an open session", async () => {
    const { sets, earlier } = await listTrendSets(owner.client, [bench.id, row.id], RANGE);

    expect(new Set(sets.map(({ exercise_id }) => exercise_id))).toEqual(
      new Set([bench.id, row.id]),
    );
    expect(sets.find(({ exercise_id }) => exercise_id === row.id)).toMatchObject({
      load_kg: 45,
      reps: 10,
      local_date: "2026-10-20",
    });
    expect(earlier.every(({ exercise_id }) => exercise_id === bench.id)).toBe(true);
  });

  it("should compare the first trained week of a longer range with the week before it", async () => {
    const rows = await listTrendSets(owner.client, [bench.id], {
      fromWeek: "2026-09-21",
      throughDay: "2026-10-20",
    });

    const [first] = exerciseWeeklyTrend(rows.sets, {
      range: "4w",
      now: "2026-10-12T12:00:00Z",
      timeZone: "UTC",
      earlier: rows.earlier,
    }).weeks;

    // Four weeks ending 12 Oct start on 21 Sep, whose own week is the first trained week; the August set
    // is its earlier week.
    expect(first).toMatchObject({ weekStart: "2026-09-21", value: { loadKg: 60, reps: 8 } });
    expect(first?.change).toMatchObject({ kind: "load", previousLoadKg: 40, latestLoadKg: 60 });
  });
});

describe("the trend hooks over the real tables", () => {
  it("should give useExerciseTrendSets the same rows, which core turns into the golden trend", async () => {
    const { wrapper } = createWrapper(owner.client);

    const { result } = renderHook(() => useExerciseTrendSets(bench.id, "4w", { now: NOW }), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    expect(result.current.data?.sets.map(({ load_kg }) => load_kg)).toEqual([60, 62.5, 60]);
    expect(trendOf(result.current.data ?? { sets: [], earlier: [] }).latest?.change).toMatchObject({
      kind: "load",
      previousLoadKg: 62.5,
      latestLoadKg: 60,
    });
  });

  it("should give useRoutineTrendSets every exercise of the routine, grouped by routine day by core", async () => {
    const { wrapper } = createWrapper(owner.client);

    const { result } = renderHook(() => useRoutineTrendSets(routineId, "4w", { now: NOW }), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    const days = routineTrendsByDay(
      [
        {
          id: "push",
          name: "push",
          position: 0,
          exercises: [{ exercise_id: bench.id, position: 0 }],
        },
        {
          id: "pull",
          name: "pull",
          position: 1,
          exercises: [
            { exercise_id: row.id, position: 0 },
            { exercise_id: bench.id, position: 1 },
          ],
        },
      ],
      result.current.data ?? { sets: [] },
      { range: "4w", now: NOW, timeZone: "UTC" },
    );
    expect(days.map((day) => day.exercises.map((entry) => entry.trend.latest?.value))).toEqual([
      [{ loadKg: 60, reps: 8 }],
      [
        { loadKg: 45, reps: 10 },
        { loadKg: 60, reps: 8 },
      ],
    ]);
  });

  it("should read again after a session write marks the trend stale", async () => {
    const { wrapper, queryClient } = createWrapper(owner.client);
    const { result } = renderHook(() => useExerciseTrendSets(row.id, "4w", { now: NOW }), {
      wrapper,
    });
    await waitFor(() => {
      expect(result.current.data?.sets).toHaveLength(1);
    });

    // A set in another week, since a week keeps only its best set.
    const midweek = await startSession(owner, "2026-10-07");
    await logSets(owner, midweek, row, [SET("2026-10-07T10:00:00Z", 50, 8)]);
    refreshSessions(queryClient);

    await waitFor(() => {
      expect(result.current.data?.sets).toHaveLength(2);
    });
  });

  it("should show another user none of the rows of this user's exercise", async () => {
    const rows = await listTrendSets(stranger.client, [row.id], RANGE);

    expect(rows).toEqual({ sets: [], earlier: [] });
  });
});
