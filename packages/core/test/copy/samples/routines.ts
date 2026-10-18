import * as copy from "../../../src/copy";

// Every function `src/copy/routines.ts` exports, called with representative arguments. The voice test fails
// when a function has no row, so no sentence escapes the sweep.
const days: readonly copy.RoutineCardDay[] = [
  { name: "Push", weekday: 0 },
  { name: "Pull", weekday: 1 },
  { name: "Legs", weekday: 3 },
  { name: "Anytime", weekday: null },
];
const routineRules = [
  "routine_name_blank",
  "routine_name_too_long",
  "days_too_many",
  "weekday_invalid",
  "weekday_repeated",
  "day_name_blank",
  "day_name_too_long",
  "exercises_too_many",
  "target_sets_invalid",
  "rep_min_invalid",
  "rep_max_invalid",
  "rep_range_inverted",
  "target_rir_invalid",
] as const;

export const samples: Record<string, () => string[]> = {
  describeArchivedRoutinesLink: () => [
    copy.describeArchivedRoutinesLink(1),
    copy.describeArchivedRoutinesLink(3),
  ],
  describeActiveRoutine: () => {
    const routine = copy.describeActiveRoutine({
      name: "Push Pull Legs",
      days,
      setsPerWeek: 63,
      activeFrom: "2026-09-21",
    });
    return [
      routine.meta,
      routine.accessibleName,
      ...routine.week.flatMap((day) => [day.weekday, day.label]),
    ];
  },
  describeOtherRoutineMeta: () => [copy.describeOtherRoutineMeta({ days, setsPerWeek: 60 })],
  describeArchivedRoutineMeta: () => [
    copy.describeArchivedRoutineMeta({ dayCount: 3, archivedOn: "2026-09-02" }),
    copy.describeArchivedRoutineMeta({ dayCount: 3, archivedOn: null }),
  ],
  describeMakeActiveName: () => [copy.describeMakeActiveName("Upper Lower")],
  describeRestoreName: () => [copy.describeRestoreName("Starting strength")],
  describeMakeActiveDialog: () =>
    ["Push Pull Legs", null].flatMap((previousActiveName) => {
      const dialog = copy.describeMakeActiveDialog({
        routineName: "Upper Lower",
        previousActiveName,
        localDate: "2026-10-15",
      });
      return [dialog.title, dialog.body, dialog.confirmAction, dialog.cancelAction];
    }),
  describeProblemsBanner: () => [1, 3].map((count) => copy.describeProblemsBanner(count)),
  describeDaysSummary: () => [copy.describeDaysSummary({ dayCount: 4, setsPerWeek: 63 })],
  describeEditorDay: () =>
    [1, null].flatMap((weekday) => {
      const day = copy.describeEditorDay({
        name: "Pull",
        weekday,
        exerciseCount: 5,
        setCount: 15,
        isOpen: weekday === null,
      });
      return [day.meta, day.weekdayLabel, day.weekdayAccessibleName, day.toggleAccessibleName];
    }),
  describeExerciseFieldNames: () => {
    const names = copy.describeExerciseFieldNames("Barbell Squat");
    return [names.sets, names.reps, names.rir];
  },
  describeRepRange: () => [copy.describeRepRange(5, 8), copy.describeRepRange(8, 8)],
  describeRoutineRule: () => [
    ...routineRules.map((rule) => copy.describeRoutineRule(rule, 1)),
    copy.describeRoutineRule("weekday_repeated", null),
  ],
};
