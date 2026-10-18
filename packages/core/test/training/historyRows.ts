import type { SetSnapshotMuscle } from "../../src/schemas";
import type { HistorySession, HistorySet } from "../../src/training";

/** A row id that `z.guid()` accepts, numbered so tests can tell ids apart. */
export const rowId = (prefix: number, n: number): string =>
  `${String(prefix).padStart(8, "0")}-0000-4000-8000-${String(n).padStart(12, "0")}`;

/** A live session that started at 18:00 UTC on Monday 19 October 2026 and ended an hour later. */
export const sessionRow = (overrides: Partial<HistorySession> = {}): HistorySession => ({
  id: rowId(4, 1),
  started_at: "2026-10-19T18:00:00Z",
  ended_at: "2026-10-19T19:00:00Z",
  local_date: "2026-10-19",
  deleted_at: null,
  ...overrides,
});

/** A live working set of the exercise numbered 1 that trains one muscle in full, at position 0. */
export const setRow = (
  overrides: Partial<Omit<HistorySet, "snapshot">> & {
    muscles?: readonly SetSnapshotMuscle[];
  } = {},
): HistorySet => {
  const { muscles = [{ muscle_id: "quads", role: "primary", weight: 1 }], ...fields } = overrides;
  return {
    id: rowId(5, 1),
    exercise_id: rowId(1, 1),
    position: 0,
    set_type: "working",
    rir: null,
    rpe: null,
    performed_at: "2026-10-19T18:05:00Z",
    deleted_at: null,
    ...fields,
    snapshot: { muscles: [...muscles] },
  };
};

/**
 * `count` working sets with their own ids and positions, so they stay apart when ordered. Calls that
 * build sets for one session give different `firstNumber`s, so their ids do not meet.
 */
export const setRows = (
  count: number,
  overrides: Parameters<typeof setRow>[0] = {},
  firstNumber = 100,
): HistorySet[] =>
  Array.from({ length: count }, (_, index) =>
    setRow({ ...overrides, id: rowId(5, firstNumber + index), position: index }),
  );
