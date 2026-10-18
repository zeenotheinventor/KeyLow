import {
  MAX_DAYS_PER_ROUTINE,
  MAX_EXERCISES_PER_ROUTINE_DAY,
  MAX_RIR,
  MAX_ROUTINE_DAY_NAME_LENGTH,
  MAX_ROUTINE_NAME_LENGTH,
  MAX_TARGET_REPS,
  MAX_TARGET_SETS,
  MAX_WEEKDAY,
  MIN_RIR,
  MIN_TARGET_REPS,
  MIN_TARGET_SETS,
  MIN_WEEKDAY,
} from "./bounds";
import { characterCount } from "../recipes/characterCount";

import type { ValidationResult } from "../diary/rules/validation";

/*
 * The routine editor's draft and the rules `save_routine` will check it against (ADR 0005, Amendment 1,
 * "Routines" and "The numbers"), so the editor can mark every problem at once before the database is
 * asked. The numbers are the numbers of the fields, and a field the editor could not read as a number is
 * NaN, which no rule accepts. Issues name where and which rule, and never carry a value or a name,
 * because training logs are health data. The sentences are screen copy and live in the apps.
 */

/** One planned exercise of a day. Its place in the day is its place in the array. */
export type RoutineDraftExercise = {
  exercise_id: string;
  target_sets: number;
  rep_min: number;
  rep_max: number;
  /** Null means no target. */
  target_rir: number | null;
};

/** One day of a draft. Its place in the routine is its place in the array. */
export type RoutineDraftDay = {
  /** The id of the stored day this one edits, so its logged sessions stay linked. Null for a new day. */
  id: string | null;
  /** 0 (Monday) to 6 (Sunday), or null for any day. */
  weekday: number | null;
  name: string;
  exercises: readonly RoutineDraftExercise[];
};

export type RoutineDraft = {
  name: string;
  days: readonly RoutineDraftDay[];
};

/** Everything a draft can get wrong, as stable codes. The sentence for each is screen copy. */
export type RoutineDraftRule =
  | "routine_name_blank"
  | "routine_name_too_long"
  | "days_too_many"
  | "weekday_invalid"
  | "weekday_repeated"
  | "day_name_blank"
  | "day_name_too_long"
  | "exercises_too_many"
  | "target_sets_invalid"
  | "rep_min_invalid"
  | "rep_max_invalid"
  | "rep_range_inverted"
  | "target_rir_invalid";

/**
 * Where a problem sits: `["name"]`, `["days"]`, `["days", 2, "weekday"]`, `["days", 2, "exercises"]`, or
 * `["days", 2, "exercises", 0, "target_sets"]`, the numbers being indexes into the draft's arrays.
 */
export type RoutineDraftPath = readonly (string | number)[];

export type RoutineDraftIssue = Readonly<{ path: RoutineDraftPath; rule: RoutineDraftRule }>;

const isWholeNumberBetween = (value: number, minimum: number, maximum: number): boolean =>
  Number.isInteger(value) && value >= minimum && value <= maximum;

const issue = (path: RoutineDraftPath, rule: RoutineDraftRule): RoutineDraftIssue => ({
  path,
  rule,
});

/** A name is counted as it will be saved, trimmed, and as the database counts it, in code points. */
const nameIssues = (
  name: string,
  path: RoutineDraftPath,
  maximumLength: number,
  blank: RoutineDraftRule,
  tooLong: RoutineDraftRule,
): RoutineDraftIssue[] => {
  if (name === "") {
    return [issue(path, blank)];
  }
  return characterCount(name) > maximumLength ? [issue(path, tooLong)] : [];
};

const exerciseIssues = (
  exercise: RoutineDraftExercise,
  path: RoutineDraftPath,
): RoutineDraftIssue[] => {
  const issues: RoutineDraftIssue[] = [];
  if (!isWholeNumberBetween(exercise.target_sets, MIN_TARGET_SETS, MAX_TARGET_SETS)) {
    issues.push(issue([...path, "target_sets"], "target_sets_invalid"));
  }
  const repMinValid = isWholeNumberBetween(exercise.rep_min, MIN_TARGET_REPS, MAX_TARGET_REPS);
  const repMaxValid = isWholeNumberBetween(exercise.rep_max, MIN_TARGET_REPS, MAX_TARGET_REPS);
  if (!repMinValid) {
    issues.push(issue([...path, "rep_min"], "rep_min_invalid"));
  }
  if (!repMaxValid) {
    issues.push(issue([...path, "rep_max"], "rep_max_invalid"));
  }
  // Only two fields that are each fine can be the wrong way round.
  if (repMinValid && repMaxValid && exercise.rep_min > exercise.rep_max) {
    issues.push(issue([...path, "rep_max"], "rep_range_inverted"));
  }
  if (
    exercise.target_rir !== null &&
    !isWholeNumberBetween(exercise.target_rir, MIN_RIR, MAX_RIR)
  ) {
    issues.push(issue([...path, "target_rir"], "target_rir_invalid"));
  }
  return issues;
};

const dayIssues = (
  day: RoutineDraftDay,
  dayIndex: number,
  weekdaysTaken: Set<number>,
): RoutineDraftIssue[] => {
  const path = ["days", dayIndex];
  const issues: RoutineDraftIssue[] = [];
  if (day.weekday !== null) {
    if (!isWholeNumberBetween(day.weekday, MIN_WEEKDAY, MAX_WEEKDAY)) {
      issues.push(issue([...path, "weekday"], "weekday_invalid"));
    } else if (weekdaysTaken.has(day.weekday)) {
      issues.push(issue([...path, "weekday"], "weekday_repeated"));
    } else {
      weekdaysTaken.add(day.weekday);
    }
  }
  issues.push(
    ...nameIssues(
      day.name.trim(),
      [...path, "name"],
      MAX_ROUTINE_DAY_NAME_LENGTH,
      "day_name_blank",
      "day_name_too_long",
    ),
  );
  if (day.exercises.length > MAX_EXERCISES_PER_ROUTINE_DAY) {
    issues.push(issue([...path, "exercises"], "exercises_too_many"));
  }
  day.exercises.forEach((exercise, exerciseIndex) => {
    issues.push(...exerciseIssues(exercise, [...path, "exercises", exerciseIndex]));
  });
  return issues;
};

const cleanedDay = (day: RoutineDraftDay): RoutineDraftDay => ({
  id: day.id,
  weekday: day.weekday,
  name: day.name.trim(),
  exercises: day.exercises.map((exercise) => ({
    exercise_id: exercise.exercise_id,
    target_sets: exercise.target_sets,
    rep_min: exercise.rep_min,
    rep_max: exercise.rep_max,
    target_rir: exercise.target_rir,
  })),
});

/**
 * Whether a routine is ready to save. The issues come back in the order the editor draws them (the
 * routine's name, then each day with its weekday, name and exercises), every one of them, never with a
 * value from the draft. A weekday two days share is marked on the later day. The reps of an exercise
 * are compared only when each is itself fine, and the inversion is marked on the highest. With no
 * issues it returns the cleaned draft, the names trimmed, which is what `routinePayload` takes.
 */
export const validateRoutineDraft = (
  draft: RoutineDraft,
): ValidationResult<RoutineDraft, readonly RoutineDraftIssue[]> => {
  const weekdaysTaken = new Set<number>();
  const issues = [
    ...nameIssues(
      draft.name.trim(),
      ["name"],
      MAX_ROUTINE_NAME_LENGTH,
      "routine_name_blank",
      "routine_name_too_long",
    ),
    ...(draft.days.length > MAX_DAYS_PER_ROUTINE ? [issue(["days"], "days_too_many")] : []),
    ...draft.days.flatMap((day, dayIndex) => dayIssues(day, dayIndex, weekdaysTaken)),
  ];
  if (issues.length > 0) {
    return { ok: false, problems: issues };
  }
  return { ok: true, value: { name: draft.name.trim(), days: draft.days.map(cleanedDay) } };
};
