import { validateRoutineDraft } from "./routineDraft";

import type {
  RoutineDraft,
  RoutineDraftDay,
  RoutineDraftExercise,
  RoutineDraftRule,
} from "./routineDraft";

/*
 * A list of small changes to a routine, for the assistant's `edit_routine` (KEY-881, decision D1).
 * Days are never removed here, because that would unlink the sessions logged from them. Existing days
 * keep their ids, so `save_routine` updates them in place.
 *
 * Where a change names an exercise a day plans twice, `position` says which (its index in the day).
 * Without it the change is refused as ambiguous. A null in `set_targets` and `update_day` keeps the
 * value it was given for, so a target RIR or a weekday cannot be cleared here.
 */

export type RoutineChange =
  | {
      op: "add";
      dayId: string;
      exerciseId: string;
      /** Where in the day the exercise goes, or null for the end. */
      position: number | null;
      sets: number;
      repMin: number;
      repMax: number;
      targetRir: number | null;
    }
  | {
      op: "swap";
      dayId: string;
      exerciseId: string;
      newExerciseId: string;
      position?: number | null;
    }
  | { op: "remove"; dayId: string; exerciseId: string; position?: number | null }
  | {
      op: "set_targets";
      dayId: string;
      exerciseId: string;
      sets: number | null;
      repMin: number | null;
      repMax: number | null;
      targetRir: number | null;
      position?: number | null;
    }
  | {
      op: "add_day";
      /** A name local to the call, which a later change can use as its `dayId`. */
      dayRef: string;
      name: string;
      weekday: number | null;
      position: number | null;
    }
  | {
      op: "update_day";
      dayId: string;
      name: string | null;
      weekday: number | null;
      position: number | null;
    };

/** Why a change was refused. The draft's own rules are passed on as they are. */
export type RoutineChangeRule =
  | "day_not_found"
  | "exercise_not_found"
  | "exercise_ambiguous"
  | "day_ref_taken"
  | "position_invalid"
  | RoutineDraftRule;

/** Which change, by its place in the list, and which rule. Never a value, because a routine is health data. */
export type RoutineChangeProblem = Readonly<{ index: number; rule: RoutineChangeRule }>;

export type RoutineChangesResult =
  { ok: true; draft: RoutineDraft } | { ok: false; problems: readonly RoutineChangeProblem[] };

/** A day while the list is applied, with the name a change can reach it by and the change that last touched it. */
type WorkingDay = Readonly<{
  reference: string | null;
  day: RoutineDraftDay;
  lastChangeIndex: number | null;
}>;

type Step = { days: readonly WorkingDay[] } | { rule: RoutineChangeRule };

type Located = { index: number } | { rule: RoutineChangeRule };

const isIndexBetween = (value: number, lowest: number, highest: number): boolean =>
  Number.isInteger(value) && value >= lowest && value <= highest;

const insertedAt = <Item>(items: readonly Item[], position: number | null, item: Item): Item[] => {
  const place = position ?? items.length;
  return [...items.slice(0, place), item, ...items.slice(place)];
};

const dayNamed = (days: readonly WorkingDay[], dayId: string): number =>
  days.findIndex((entry) => entry.day.id === dayId || entry.reference === dayId);

/** The one exercise a change means, by its id and, when the day plans it twice, its position. */
const locateExercise = (
  exercises: readonly RoutineDraftExercise[],
  exerciseId: string,
  position: number | null | undefined,
): Located => {
  if (position !== null && position !== undefined) {
    return exercises[position]?.exercise_id === exerciseId
      ? { index: position }
      : { rule: "exercise_not_found" };
  }
  const matches = exercises.flatMap((exercise, index) =>
    exercise.exercise_id === exerciseId ? [index] : [],
  );
  const [only, ...others] = matches;
  if (only === undefined) {
    return { rule: "exercise_not_found" };
  }
  return others.length > 0 ? { rule: "exercise_ambiguous" } : { index: only };
};

const withDayAt = (
  days: readonly WorkingDay[],
  dayIndex: number,
  day: RoutineDraftDay,
  changeIndex: number,
): WorkingDay[] =>
  days.map((entry, index) =>
    index === dayIndex ? { ...entry, day, lastChangeIndex: changeIndex } : entry,
  );

const stepOnExercise = (
  days: readonly WorkingDay[],
  change: Extract<RoutineChange, { op: "swap" | "remove" | "set_targets" }>,
  changeIndex: number,
  edit: (exercise: RoutineDraftExercise) => RoutineDraftExercise | null,
): Step => {
  const dayIndex = dayNamed(days, change.dayId);
  const entry = days[dayIndex];
  if (entry === undefined) {
    return { rule: "day_not_found" };
  }
  const located = locateExercise(entry.day.exercises, change.exerciseId, change.position);
  if ("rule" in located) {
    return located;
  }
  const edited = entry.day.exercises.flatMap((exercise, index) => {
    if (index !== located.index) {
      return [exercise];
    }
    const replacement = edit(exercise);
    return replacement === null ? [] : [replacement];
  });
  return { days: withDayAt(days, dayIndex, { ...entry.day, exercises: edited }, changeIndex) };
};

const stepOnAdd = (
  days: readonly WorkingDay[],
  change: Extract<RoutineChange, { op: "add" }>,
  changeIndex: number,
): Step => {
  const dayIndex = dayNamed(days, change.dayId);
  const entry = days[dayIndex];
  if (entry === undefined) {
    return { rule: "day_not_found" };
  }
  const { exercises } = entry.day;
  if (change.position !== null && !isIndexBetween(change.position, 0, exercises.length)) {
    return { rule: "position_invalid" };
  }
  const planned: RoutineDraftExercise = {
    exercise_id: change.exerciseId,
    target_sets: change.sets,
    rep_min: change.repMin,
    rep_max: change.repMax,
    target_rir: change.targetRir,
  };
  const day = { ...entry.day, exercises: insertedAt(exercises, change.position, planned) };
  return { days: withDayAt(days, dayIndex, day, changeIndex) };
};

const stepOnAddDay = (
  days: readonly WorkingDay[],
  change: Extract<RoutineChange, { op: "add_day" }>,
  changeIndex: number,
): Step => {
  if (days.some((entry) => entry.reference === change.dayRef || entry.day.id === change.dayRef)) {
    return { rule: "day_ref_taken" };
  }
  if (change.position !== null && !isIndexBetween(change.position, 0, days.length)) {
    return { rule: "position_invalid" };
  }
  const added: WorkingDay = {
    reference: change.dayRef,
    day: { id: null, weekday: change.weekday, name: change.name, exercises: [] },
    lastChangeIndex: changeIndex,
  };
  return { days: insertedAt(days, change.position, added) };
};

const stepOnUpdateDay = (
  days: readonly WorkingDay[],
  change: Extract<RoutineChange, { op: "update_day" }>,
  changeIndex: number,
): Step => {
  const dayIndex = dayNamed(days, change.dayId);
  const entry = days[dayIndex];
  if (entry === undefined) {
    return { rule: "day_not_found" };
  }
  if (change.position !== null && !isIndexBetween(change.position, 0, days.length - 1)) {
    return { rule: "position_invalid" };
  }
  const updated: WorkingDay = {
    ...entry,
    day: {
      ...entry.day,
      name: change.name ?? entry.day.name,
      weekday: change.weekday ?? entry.day.weekday,
    },
    lastChangeIndex: changeIndex,
  };
  if (change.position === null) {
    return { days: days.map((other, index) => (index === dayIndex ? updated : other)) };
  }
  const others = days.filter((_other, index) => index !== dayIndex);
  return { days: insertedAt(others, change.position, updated) };
};

const stepOf = (days: readonly WorkingDay[], change: RoutineChange, changeIndex: number): Step => {
  switch (change.op) {
    case "add":
      return stepOnAdd(days, change, changeIndex);
    case "swap":
      return stepOnExercise(days, change, changeIndex, (exercise) => ({
        ...exercise,
        exercise_id: change.newExerciseId,
      }));
    case "remove":
      return stepOnExercise(days, change, changeIndex, () => null);
    case "set_targets":
      return stepOnExercise(days, change, changeIndex, (exercise) => ({
        exercise_id: exercise.exercise_id,
        target_sets: change.sets ?? exercise.target_sets,
        rep_min: change.repMin ?? exercise.rep_min,
        rep_max: change.repMax ?? exercise.rep_max,
        target_rir: change.targetRir ?? exercise.target_rir,
      }));
    case "add_day":
      return stepOnAddDay(days, change, changeIndex);
    case "update_day":
      return stepOnUpdateDay(days, change, changeIndex);
  }
};

const latestOf = (indexes: readonly (number | null)[]): number | null =>
  indexes.reduce<number | null>(
    (latest, index) => (index !== null && (latest === null || index > latest) ? index : latest),
    null,
  );

/**
 * The change a broken draft rule is blamed on: the last one that touched the day it sits on. A weekday
 * two days share is blamed on the later of their two last changes, and a rule about the whole routine
 * on the last day added. A rule no change touched is blamed on the last change.
 */
const blamedChangeIndex = (
  days: readonly WorkingDay[],
  path: readonly (string | number)[],
  rule: RoutineDraftRule,
  lastDayAddIndex: number | null,
  lastChangeIndex: number,
): number => {
  const dayIndex = path[0] === "days" ? path[1] : undefined;
  if (typeof dayIndex !== "number") {
    return (rule === "days_too_many" ? lastDayAddIndex : null) ?? lastChangeIndex;
  }
  const weekday = days[dayIndex]?.day.weekday;
  const involved =
    rule === "weekday_repeated"
      ? days.filter((entry) => entry.day.weekday === weekday)
      : [days[dayIndex]];
  return latestOf(involved.map((entry) => entry?.lastChangeIndex ?? null)) ?? lastChangeIndex;
};

const withoutRepeats = (problems: readonly RoutineChangeProblem[]): RoutineChangeProblem[] =>
  problems.filter(
    (problem, index) =>
      problems.findIndex(
        (other) => other.index === problem.index && other.rule === problem.rule,
      ) === index,
  );

/**
 * Applies the changes one after the other, each against the draft the earlier ones left, and checks the
 * result with `validateRoutineDraft` once at the end, so two changes may fix each other. It is all or
 * nothing: one problem and there is no draft. The problems say which change, by its place in the list,
 * and which rule, never a name, an id or a number. The draft it is given is not changed.
 */
export const applyRoutineChanges = (
  draft: RoutineDraft,
  changes: readonly RoutineChange[],
): RoutineChangesResult => {
  let days: readonly WorkingDay[] = draft.days.map((day) => ({
    reference: null,
    day,
    lastChangeIndex: null,
  }));
  let lastDayAddIndex: number | null = null;
  const problems: RoutineChangeProblem[] = [];

  changes.forEach((change, index) => {
    const step = stepOf(days, change, index);
    if ("rule" in step) {
      problems.push({ index, rule: step.rule });
      return;
    }
    days = step.days;
    if (change.op === "add_day") {
      lastDayAddIndex = index;
    }
  });
  if (problems.length > 0) {
    return { ok: false, problems };
  }

  const validated = validateRoutineDraft({
    name: draft.name,
    days: days.map((entry) => entry.day),
  });
  if (validated.ok) {
    return { ok: true, draft: validated.value };
  }
  const lastChangeIndex = Math.max(changes.length - 1, 0);
  return {
    ok: false,
    problems: withoutRepeats(
      validated.problems.map(({ path, rule }) => ({
        index: blamedChangeIndex(days, path, rule, lastDayAddIndex, lastChangeIndex),
        rule,
      })),
    ),
  };
};

/**
 * A stable text of what a draft holds: the routine's name, then each day in order with its weekday and
 * name and each exercise in order with its targets. The ids of days are left out, because a new day gets
 * one on save, and so are the ids of planned rows, which the draft never holds. Two reads of the same
 * routine give the same text, and any change to a field, or to an order, gives another. It names
 * exercises and days, so it is health data and is kept only where a routine may be.
 */
export const routineFingerprint = (draft: RoutineDraft): string =>
  JSON.stringify([
    draft.name.trim(),
    draft.days.map((day) => [
      day.weekday,
      day.name.trim(),
      day.exercises.map((exercise) => [
        exercise.exercise_id,
        exercise.target_sets,
        exercise.rep_min,
        exercise.rep_max,
        exercise.target_rir,
      ]),
    ]),
  ]);
