import * as copy from "../../../src/copy";

import type { TodayCard } from "../../../src/training";

// Every function `src/copy/train.ts` exports, called with representative arguments. The voice test fails
// when a function has no row, so no sentence escapes the sweep.
const thursday: copy.TodayCardContext = {
  localDate: "2026-10-15",
  nextExerciseName: "Leg Press",
  recovery: null,
};
const wednesday: copy.TodayCardContext = {
  localDate: "2026-10-14",
  nextExerciseName: null,
  recovery: { muscles: ["lats", "biceps"], trainedOn: "2026-10-13" },
};
const legsDay = { id: "legs", name: "Legs" };
const planned: TodayCard = {
  kind: "planned",
  routineName: "Push Pull Legs",
  dayName: "Legs",
  dayNumber: 3,
  dayCount: 4,
  exerciseCount: 5,
  setCount: 16,
  estimatedMinutes: 50,
};
const inProgress: TodayCard = {
  kind: "in_progress",
  dayName: "Legs",
  minutesSoFar: 30,
  setsLogged: 8,
  setsPlanned: 16,
  nextSet: { exerciseId: "leg-press", setNumber: 3 },
};
const done: TodayCard = {
  kind: "done",
  dayName: "Legs",
  minutes: 30,
  setsLogged: 8,
  setsPlanned: 16,
  next: { date: "2026-10-17", id: "push", name: "Push" },
};
const weekDay = {
  date: "2026-10-15",
  isToday: true,
  plannedDay: legsDay,
  sessionDay: legsDay,
  setsLogged: 8,
  setsPlanned: 16,
  madeUpBy: null,
} as const;

/** Every sentence of a Today card's copy, whatever its kind. */
const sentencesOf = (card: copy.TodayCardCopy): string[] =>
  Object.entries(card).flatMap(([key, value]) =>
    key !== "kind" && typeof value === "string" ? [value] : [],
  );

export const samples: Record<string, () => string[]> = {
  describeTodayHeading: () => [copy.describeTodayHeading("2026-10-15")],
  describeTodayCard: () => [
    ...sentencesOf(copy.describeTodayCard(planned, thursday)),
    ...sentencesOf(
      copy.describeTodayCard(
        {
          ...planned,
          madeUp: [
            { date: "2026-10-12", dayName: "Push" },
            { date: "2026-10-13", dayName: "Pull" },
          ],
        },
        thursday,
      ),
    ),
    ...sentencesOf(copy.describeTodayCard(inProgress, thursday)),
    ...sentencesOf(
      copy.describeTodayCard({ ...inProgress, dayName: null, setsPlanned: 0 }, thursday),
    ),
    ...sentencesOf(copy.describeTodayCard(done, thursday)),
    ...sentencesOf(copy.describeTodayCard({ ...done, next: null }, thursday)),
    ...sentencesOf(
      copy.describeTodayCard(
        { kind: "rest", next: { date: "2026-10-15", id: "legs", name: "Legs" } },
        wednesday,
      ),
    ),
    ...sentencesOf(
      copy.describeTodayCard(
        { kind: "rest", next: null, madeUp: [{ date: "2026-10-13", dayName: "Legs" }] },
        wednesday,
      ),
    ),
    ...sentencesOf(
      copy.describeTodayCard(
        { kind: "rest", next: null },
        { ...wednesday, recovery: { muscles: ["neck"], trainedOn: "2026-10-13" } },
      ),
    ),
  ],
  describeTrainWeekCaption: () => [
    copy.describeTrainWeekCaption("2026-10-12", {
      plannedDayCount: 4,
      loggedDayCount: 2,
      loggedSessionCount: 2,
    }),
    copy.describeTrainWeekCaption("2026-10-12", {
      plannedDayCount: 0,
      loggedDayCount: 0,
      loggedSessionCount: 1,
    }),
  ],
  describeTrainWeekDay: () =>
    (["logged", "in_progress", "today", "planned", "missed", "rest", "extra"] as const).flatMap(
      (status) =>
        [true, false].flatMap((hasRoutine) => {
          const { weekday, label, accessibleName } = copy.describeTrainWeekDay(
            { ...weekDay, status },
            hasRoutine,
          );
          const madeUp = copy.describeTrainWeekDay(
            { ...weekDay, status, madeUpBy: { local_date: "2026-10-16" } },
            hasRoutine,
          );
          // A rest day with no routine has no label to say, which is the one empty string by design.
          return [weekday, ...(label === "" ? [] : [label]), accessibleName, madeUp.accessibleName];
        }),
    ),
  describeSessionClock: () => [
    copy.describeSessionClock(0),
    copy.describeSessionClock(1800),
    copy.describeSessionClock(3720),
  ],
  describeSessionBar: () =>
    [
      { dayName: "Legs", clockSeconds: 1800, setsLogged: 8, setsPlanned: 16 },
      { dayName: null, clockSeconds: 60, setsLogged: 1, setsPlanned: 0 },
    ].flatMap((input) => {
      const { name, detail, accessibleName } = copy.describeSessionBar(input);
      return [name, detail, accessibleName];
    }),
  describePickDayRow: () => {
    const row = copy.describePickDayRow({
      name: "Legs",
      date: "2026-10-15",
      exerciseCount: 5,
      setCount: 16,
    });
    return [row.title, row.meta, row.weekdayLabel];
  },
  describeOfflineBanner: () => [copy.describeOfflineBanner("17:52")],
};
