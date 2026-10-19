import { pushPullLegsDraft } from "./support/routineEditorFixtures";
import { routineMarksOf } from "../components/RoutineEditor";

import type { RoutineDraft } from "@keylow/core/training";

// The folder's index brings the editor with it, which reads the theme and the router.
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

// Where `validateRoutineDraft`'s problems are marked in the editor, and how many the banner counts: one for
// each place the `routines · invalid` board marks (the name, a day's weekday, an exercise's row).

const withLegsOnTuesday = (change: (draft: RoutineDraft) => RoutineDraft): RoutineDraft =>
  change({
    ...pushPullLegsDraft,
    days: pushPullLegsDraft.days.map((day) => (day.name === "Legs" ? { ...day, weekday: 1 } : day)),
  });

const withLegPress = (
  draft: RoutineDraft,
  change: Partial<RoutineDraft["days"][number]["exercises"][number]>,
): RoutineDraft => ({
  ...draft,
  days: draft.days.map((day, position) =>
    position === 2
      ? {
          ...day,
          exercises: day.exercises.map((exercise, place) =>
            place === 2 ? { ...exercise, ...change } : exercise,
          ),
        }
      : day,
  ),
});

describe("the marks of a routine draft's problems", () => {
  it("should find no mark and count nothing in a routine that can be saved", () => {
    const marks = routineMarksOf(pushPullLegsDraft);

    expect(marks.count).toBe(0);
    expect(marks.name).toBeUndefined();
  });

  it("should mark the invalid board's three places: the name, the second Tuesday and the leg press row", () => {
    const board = withLegPress(
      withLegsOnTuesday((draft) => ({ ...draft, name: "" })),
      { target_sets: 0, rep_min: 12, rep_max: 10 },
    );

    const marks = routineMarksOf(board);

    expect(marks.count).toBe(3);
    expect(marks.name).toBe("Give the routine a name.");
    expect(marks.days[2]?.header).toBe("Only one day can be on Tuesday.");
    expect(marks.days[1]?.header).toBeUndefined();
    expect(marks.days[2]?.exercises[2]).toStrictEqual({
      sets: "Enter sets from 1 to 20.",
      reps: "The lowest reps cannot be above the highest.",
      rir: undefined,
      line: "Enter sets from 1 to 20. The lowest reps cannot be above the highest.",
    });
    expect(marks.days[2]?.exercises[1]).toBeUndefined();
  });

  it("should give a field that was emptied or unreadable (NaN) the sentence of its rule", () => {
    const marks = routineMarksOf(
      withLegPress(pushPullLegsDraft, {
        target_sets: Number.NaN,
        rep_max: Number.NaN,
        target_rir: Number.NaN,
      }),
    );

    expect(marks.days[2]?.exercises[2]).toMatchObject({
      sets: "Enter sets from 1 to 20.",
      reps: "Enter the highest reps from 1 to 100.",
      rir: "Enter RIR from 0 to 10, or leave it empty.",
    });
    expect(marks.count).toBe(1);
  });

  it("should mark the day name on the day and not on its header", () => {
    const marks = routineMarksOf({
      ...pushPullLegsDraft,
      days: pushPullLegsDraft.days.map((day, position) =>
        position === 1 ? { ...day, name: "  " } : day,
      ),
    });

    expect(marks.days[1]).toMatchObject({ name: "Give the day a name.", header: undefined });
    expect(marks.count).toBe(1);
  });

  it("should mark the name that is too long and count it once", () => {
    const marks = routineMarksOf({ ...pushPullLegsDraft, name: "x".repeat(201) });

    expect(marks.name).toBe("Use 200 characters or fewer for the routine name.");
    expect(marks.count).toBe(1);
  });
});
