import * as copy from "../../../src/copy";

import type { SessionSummary } from "../../../src/training";

// Every function `src/copy/history.ts` exports, called with representative arguments. The voice test fails
// when a function has no row, so no sentence escapes the sweep.
const summary: SessionSummary = {
  durationMinutes: 51,
  workingSets: 17,
  warmupSets: 1,
  topMuscles: ["lats", "biceps", "traps_mid"],
  titleSource: "Pull",
  planComparison: {
    setsOverPlan: [{ exerciseId: "wide-grip-lat-pulldown", setsOver: 2 }],
    exercisesNotLogged: [],
  },
};
const openSummary: SessionSummary = {
  ...summary,
  durationMinutes: null,
  titleSource: null,
  planComparison: { setsOverPlan: [], exercisesNotLogged: ["face-pull"] },
};
const workingSet: copy.HistorySetInput = {
  setType: "working",
  setNumber: 3,
  loadKg: 70,
  reps: 10,
  rir: 2,
  isNotInPlan: false,
  unit: "kg",
};
const sheet: copy.EditSetSheetInput = {
  exerciseName: "Barbell Curl",
  setType: "working",
  setNumber: 3,
  performedAt: "2026-10-13T18:51:00+01:00",
  tz: "Europe/London",
};

/** A sentence that may be absent, as a list of the sentences it gives. */
const present = (text: string | null): string[] => (text === null ? [] : [text]);

export const samples: Record<string, () => string[]> = {
  describeHistoryWeek: () =>
    ["2026-10-12", "2026-10-05", "2026-09-28"].flatMap((weekStart) => {
      const week = copy.describeHistoryWeek(
        { weekStart, sessionCount: 3, workingSetTotal: 41 },
        "2026-10-12",
      );
      return [week.name, week.total];
    }),
  describeSessionBackLabel: () => [
    copy.describeSessionBackLabel("history"),
    copy.describeSessionBackLabel("train"),
  ],
  describeOpenSessionName: () => [copy.describeOpenSessionName("Pull, Tue 13 October")],
  describeResumeSessionName: () => [copy.describeResumeSessionName("Pull, Tue 13 October")],
  describeHistorySessionName: () => [
    copy.describeHistorySessionName("Pull"),
    copy.describeHistorySessionName(null),
  ],
  describeHistoryRow: () =>
    [summary, openSummary].flatMap((rowSummary) => {
      const row = copy.describeHistoryRow({ localDate: "2026-10-13", summary: rowSummary });
      return [
        row.weekday,
        row.dayOfMonth,
        row.name,
        row.meta,
        ...present(row.muscles),
        row.accessibleName,
      ];
    }),
  describeSessionWhen: () => [
    copy.describeSessionWhen({
      localDate: "2026-10-13",
      startedAt: "2026-10-13T18:00:00+01:00",
      endedAt: "2026-10-13T18:51:00+01:00",
      tz: "Europe/London",
    }),
    copy.describeSessionWhen({
      localDate: "2026-10-13",
      startedAt: "2026-10-13T18:00:00+01:00",
      endedAt: null,
      tz: "Europe/London",
    }),
  ],
  describeSessionStats: () =>
    [summary, openSummary, { ...summary, planComparison: null }].flatMap((statsSummary) => {
      const { time, sets, plan } = copy.describeSessionStats(statsSummary);
      return [time, sets, ...(plan === null ? [] : [plan])].flatMap(({ label, value, note }) => [
        label,
        value,
        ...present(note),
      ]);
    }),
  describeSessionExerciseNote: () => [
    ...present(copy.describeSessionExerciseNote({ isBodyweight: true, setsOver: 1 })),
    ...present(copy.describeSessionExerciseNote({ isBodyweight: false, setsOver: 2 })),
  ],
  describeHistorySet: () =>
    (["warmup", "working", "drop", "failure"] as const).flatMap((setType) => {
      const set = copy.describeHistorySet({ ...workingSet, setType });
      return [set.label, set.what, set.rir, set.description, set.accessibleName];
    }),
  describeEditSetSheet: () => {
    const { accessibleName, title, subtitle } = copy.describeEditSetSheet(sheet);
    return [accessibleName, title, subtitle];
  },
  describeLoadFieldLabel: () => [
    copy.describeLoadFieldLabel("kg"),
    copy.describeLoadFieldLabel("lb"),
  ],
  describeDeleteSessionBody: () =>
    [17, 1, 0].map((setCount) =>
      copy.describeDeleteSessionBody({ setCount, dayName: "Pull", localDate: "2026-10-13" }),
    ),
};
