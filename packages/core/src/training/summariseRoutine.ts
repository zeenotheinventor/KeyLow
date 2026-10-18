/** A routine as the summary reads it: stored days and an editor's draft both fit. */
export type SummarisedRoutine = Readonly<{
  days: readonly Readonly<{
    weekday: number | null;
    exercises: readonly Readonly<{ target_sets: number }>[];
  }>[];
}>;

export type RoutineDaySummary = Readonly<{
  /** 0 (Monday) to 6 (Sunday), or null for any day. */
  weekday: number | null;
  exerciseCount: number;
  setCount: number;
}>;

export type RoutineSummary = Readonly<{
  dayCount: number;
  /** One entry for each day, in the order the days were given. */
  days: readonly RoutineDaySummary[];
  /** The sets of every day, each day being done once a week. */
  setsPerWeek: number;
}>;

/**
 * What a routine card shows: how many days, each day's weekday, exercises and sets, and the sets in a
 * week (63 for the golden Push Pull Legs). A day with no weekday means any day and still counts once.
 */
export const summariseRoutine = (routine: SummarisedRoutine): RoutineSummary => {
  const days = routine.days.map((day) => ({
    weekday: day.weekday,
    exerciseCount: day.exercises.length,
    setCount: day.exercises.reduce((sets, exercise) => sets + exercise.target_sets, 0),
  }));
  return {
    dayCount: days.length,
    days,
    setsPerWeek: days.reduce((sets, day) => sets + day.setCount, 0),
  };
};
