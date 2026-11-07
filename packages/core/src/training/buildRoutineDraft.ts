import { MAX_DAYS_PER_ROUTINE } from "./bounds";
import { exerciseTargetFor } from "./goalPresets";
import { validateRoutineDraft } from "./routineDraft";
import { estimateSessionMinutes } from "./sessionTime";
import { SUGGEST_PARAMS_V2 } from "./suggest/suggestParams";
import { summariseRoutine } from "./summariseRoutine";

import type { ExerciseMechanic, ExperienceLevel, TrainingGoal } from "./enums";
import type { GoalPresets } from "./goalPresets";
import type { RoutineDraft, RoutineDraftIssue, RoutineDraftRule } from "./routineDraft";
import type { SessionTimeParams } from "./sessionTime";
import type { RoutineDaySummary, RoutineSummary } from "./summariseRoutine";

/*
 * A routine built from exercise ids alone. The sets, reps and target RIR are never asked for: each comes
 * from Ki-Lo's goal presets through `exerciseTargetFor`, the same place a suggested exercise reads them,
 * so a built routine cannot drift from a suggestion. A problem names where and which rule and never a
 * name or a number, because a routine is health data.
 */

/** What the builder refuses besides the rules of `validateRoutineDraft`. */
export type BuildRoutineRule =
  "days_none" | "exercises_none" | "exercise_unknown" | "exercise_repeated";

export type BuildRoutineProblem = Readonly<{
  path: RoutineDraftIssue["path"];
  rule: BuildRoutineRule | RoutineDraftRule;
}>;

export type RoutineToBuild = Readonly<{
  name: string;
  days: readonly Readonly<{
    name: string;
    weekday: number | null;
    exerciseIds: readonly string[];
  }>[];
}>;

export type BuildRoutineResult =
  { ok: true; draft: RoutineDraft } | { ok: false; problems: BuildRoutineProblem[] };

const problem = (
  path: RoutineDraftIssue["path"],
  rule: BuildRoutineProblem["rule"],
): BuildRoutineProblem => ({ path, rule });

/** The problems of the shape and the ids, before any number is chosen. A day over the cap is refused whole. */
const shapeProblems = (
  { days }: RoutineToBuild,
  exercises: ReadonlyMap<string, unknown>,
): BuildRoutineProblem[] => {
  if (days.length === 0) {
    return [problem(["days"], "days_none")];
  }
  const problems: BuildRoutineProblem[] =
    days.length > MAX_DAYS_PER_ROUTINE ? [problem(["days"], "days_too_many")] : [];
  days.forEach((day, dayIndex) => {
    const path = ["days", dayIndex, "exercises"];
    if (day.exerciseIds.length === 0) {
      problems.push(problem(path, "exercises_none"));
    } else if (day.exerciseIds.length > SUGGEST_PARAMS_V2.maxExercises.fresh) {
      problems.push(problem(path, "exercises_too_many"));
    }
    const seen = new Set<string>();
    day.exerciseIds.forEach((id, exerciseIndex) => {
      if (!exercises.has(id)) {
        problems.push(problem([...path, exerciseIndex], "exercise_unknown"));
      } else if (seen.has(id)) {
        problems.push(problem([...path, exerciseIndex], "exercise_repeated"));
      }
      seen.add(id);
    });
  });
  return problems;
};

/**
 * A new routine's draft: every day new (`id` null), every exercise given the sets, reps and target RIR of
 * the goal, the exercise's mechanic and the experience. It refuses with every problem it finds and builds
 * nothing: no day, a day with no exercise, more than `MAX_DAYS_PER_ROUTINE` days, more exercises in a day
 * than Ki-Lo suggests for one session (`SUGGEST_PARAMS_V2.maxExercises.fresh`), an id that is not in
 * `exercises`, and an exercise twice in a day. What is left goes through `validateRoutineDraft`, so a
 * blank name or a repeated weekday is refused with its rules.
 */
export const buildRoutineDraft = (
  input: RoutineToBuild,
  exercises: ReadonlyMap<string, { mechanic: ExerciseMechanic }>,
  { goal, experience }: { goal: TrainingGoal; experience: ExperienceLevel },
  presets: GoalPresets,
): BuildRoutineResult => {
  const problems = shapeProblems(input, exercises);
  if (problems.length > 0) {
    return { ok: false, problems };
  }
  const checked = validateRoutineDraft({
    name: input.name,
    days: input.days.map((day) => ({
      id: null,
      weekday: day.weekday,
      name: day.name,
      exercises: day.exerciseIds.flatMap((id) => {
        const exercise = exercises.get(id);
        if (exercise === undefined) {
          return [];
        }
        const target = exerciseTargetFor(
          { goal, experience, mechanic: exercise.mechanic },
          presets,
        );
        return [
          {
            exercise_id: id,
            target_sets: target.sets,
            rep_min: target.repMin,
            rep_max: target.repMax,
            target_rir: target.targetRir,
          },
        ];
      }),
    })),
  });
  return checked.ok
    ? { ok: true, draft: checked.value }
    : { ok: false, problems: [...checked.problems] };
};

export type BuiltRoutineDaySummary = RoutineDaySummary & Readonly<{ minutes: number }>;

export type BuiltRoutineSummary = Omit<RoutineSummary, "days"> &
  Readonly<{ days: readonly BuiltRoutineDaySummary[] }>;

/**
 * What the assistant quotes about a built routine, so it adds nothing up itself: each day's exercises and
 * sets from `summariseRoutine`, the minutes a day takes from `estimateSessionMinutes`, and the sets in a
 * week.
 */
export const summariseBuiltRoutine = (
  draft: RoutineDraft,
  sessionTime: SessionTimeParams,
): BuiltRoutineSummary => {
  const summary = summariseRoutine(draft);
  return {
    ...summary,
    days: summary.days.map((day) => ({
      ...day,
      minutes: estimateSessionMinutes(
        { exercises: day.exerciseCount, sets: day.setCount },
        sessionTime,
      ),
    })),
  };
};
