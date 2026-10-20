import { exerciseWeeklyTrend } from "./exerciseTrend";

import type { ExerciseTrend, TrendRange, TrendSet } from "./exerciseTrend";

/** A routine exercise as the grouping reads it. Anything else it carries (a name, the target) passes through. */
type TrendRoutineExercise = { exercise_id: string; position: number };

type TrendRoutineDay<Exercise extends TrendRoutineExercise> = {
  id: string;
  name: string;
  position: number;
  exercises: readonly Exercise[];
};

export type RoutineDayTrends<Exercise extends TrendRoutineExercise> = Readonly<{
  id: string;
  name: string;
  exercises: readonly Readonly<{ exercise: Exercise; trend: ExerciseTrend }>[];
}>;

const byPosition = (first: { position: number }, second: { position: number }): number =>
  first.position - second.position;

/**
 * A routine's exercises grouped by routine day, each with its own trend. Days and exercises come in
 * position order, and an exercise a day plans twice is listed once, at its first place. The sets are
 * every set the user logged, of any session, any routine day or none: a trend counts them all, and an
 * exercise's trend reads only the sets of that exercise. An exercise with no sets has the not-trained
 * trend. The sets and the earlier sets are given for every exercise at once. Throws what `exerciseWeeklyTrend` throws.
 */
export const routineTrendsByDay = <Exercise extends TrendRoutineExercise>(
  days: readonly TrendRoutineDay<Exercise>[],
  {
    sets,
    earlier = [],
  }: {
    sets: readonly (TrendSet & { exercise_id: string })[];
    /** Sets of weeks before the range, as `exerciseWeeklyTrend` reads them. */
    earlier?: readonly (TrendSet & { exercise_id: string })[];
  },
  options: { range: TrendRange; now: string; timeZone: string },
): RoutineDayTrends<Exercise>[] => {
  const groupByExercise = (rows: readonly (TrendSet & { exercise_id: string })[]) => {
    const grouped = new Map<string, TrendSet[]>();
    for (const row of rows) {
      const group = grouped.get(row.exercise_id);
      if (group === undefined) {
        grouped.set(row.exercise_id, [row]);
      } else {
        group.push(row);
      }
    }
    return grouped;
  };
  const setsByExercise = groupByExercise(sets);
  const earlierByExercise = groupByExercise(earlier);

  return [...days].sort(byPosition).map(({ id, name, exercises }) => {
    const listed = new Set<string>();
    const firstPlaces = [...exercises].sort(byPosition).filter(({ exercise_id }) => {
      const isFirst = !listed.has(exercise_id);
      listed.add(exercise_id);
      return isFirst;
    });
    return {
      id,
      name,
      exercises: firstPlaces.map((exercise) => ({
        exercise,
        trend: exerciseWeeklyTrend(setsByExercise.get(exercise.exercise_id) ?? [], {
          ...options,
          earlier: earlierByExercise.get(exercise.exercise_id) ?? [],
        }),
      })),
    };
  });
};
