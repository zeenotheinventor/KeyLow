import {
  MAX_LOAD_KG,
  MAX_REPS,
  MAX_RIR,
  MAX_RPE,
  MIN_REPS,
  MIN_RIR,
  MIN_RPE,
  RPE_STEP,
} from "./bounds";
import { displayLoad, loadToKg } from "./loads";

import type { SetType } from "./enums";
import type { LoadUnit } from "./loads";

/**
 * Which effort measure a user logs: reps in reserve (the default) or rate of perceived exertion (a
 * setting). Only one of the two is ever written to a set.
 */
export type EffortMode = "rir" | "rpe";

/**
 * A stable code naming the rule a set field broke, with the bounds of `bounds.ts` in its name. It is
 * never a sentence and never carries the value: the sentences are screen copy, and a load, rep count
 * or effort is health data that must not reach a log.
 */
export type SetInputRule =
  | "load_not_a_number"
  | "load_ambiguous_separator"
  | "load_0_to_1000_kg"
  | "reps_whole_1_to_100"
  | "rir_whole_0_to_10"
  | "rpe_1_to_10_in_halves"
  | "effort_one_measure_only";

/** The fields of a set, in the order of the form. */
export type SetInputField = "load" | "reps" | "rir" | "rpe";

export type SetDraftIssue = Readonly<{ field: SetInputField; rule: SetInputRule }>;

type Refused = Readonly<{ ok: false; rule: SetInputRule }>;

export type LoadInputResult = Readonly<{ ok: true; kg: number | null }> | Refused;
export type RepsInputResult = Readonly<{ ok: true; reps: number }> | Refused;
export type EffortInputResult = Readonly<{ ok: true; value: number | null }> | Refused;

/** The text of a set as the form holds it. Effort is held per measure: only the one in use may be filled. */
export type SetDraft = Readonly<{
  setType: SetType;
  load: string;
  reps: string;
  rir: string;
  rpe: string;
}>;

/** A set's numbers once cleaned. `loadKg` is in whole grams, and at most one of `rir` and `rpe` is set. */
export type SetValues = Readonly<{
  setType: SetType;
  loadKg: number | null;
  reps: number;
  rir: number | null;
  rpe: number | null;
}>;

export type SetDraftResult =
  | Readonly<{ ok: true; values: SetValues }>
  | Readonly<{ ok: false; issues: readonly SetDraftIssue[] }>;

type SetDraftOptions = Readonly<{ unit: LoadUnit; effortMode: EffortMode }>;

// Digits with at most one decimal comma or point, and an optional minus so that "-5" reads as out of range.
const NUMBER_TEXT = /^-?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/;
// Up to three digits, a comma or point, then exactly three digits: "1,000" may mean a thousand, not one.
const THOUSANDS_LOOKALIKE = /^[1-9]\d{0,2}[.,]\d{3}$/;
const WHOLE_NUMBER_TEXT = /^\d+$/;

const refuse = (rule: SetInputRule): Refused => ({ ok: false, rule });

const numberOf = (text: string): number => Number(text.replace(",", "."));

const isLoadInRange = (kg: number): boolean => kg >= 0 && kg <= MAX_LOAD_KG;
const isRepsInRange = (reps: number): boolean =>
  Number.isInteger(reps) && reps >= MIN_REPS && reps <= MAX_REPS;
const isRirInRange = (rir: number): boolean =>
  Number.isInteger(rir) && rir >= MIN_RIR && rir <= MAX_RIR;
const isRpeInRange = (rpe: number): boolean =>
  rpe >= MIN_RPE && rpe <= MAX_RPE && Number.isInteger(rpe / RPE_STEP);

/**
 * Reads what the load field holds: a decimal comma or point, spaces around, in the user's unit.
 * Returns the load in kilograms rounded to the gram, null for a blank entry (an unloaded bodyweight
 * set), or the rule it breaks. A separator followed by exactly three digits ("1,000") is refused as
 * ambiguous, because it can be read as 1 or as a thousand. The 0 to 1,000 kg bound is checked on the
 * converted kilograms.
 */
export const parseLoadInput = (text: string, unit: LoadUnit): LoadInputResult => {
  const trimmed = text.trim();
  if (trimmed === "") {
    return { ok: true, kg: null };
  }
  if (!NUMBER_TEXT.test(trimmed)) {
    return refuse("load_not_a_number");
  }
  if (THOUSANDS_LOOKALIKE.test(trimmed)) {
    return refuse("load_ambiguous_separator");
  }
  const kg = loadToKg(numberOf(trimmed), unit);
  return isLoadInRange(kg) ? { ok: true, kg } : refuse("load_0_to_1000_kg");
};

/** Reads what the reps field holds: a whole number from 1 to 100. A blank entry is refused. */
export const parseRepsInput = (text: string): RepsInputResult => {
  const trimmed = text.trim();
  const reps = WHOLE_NUMBER_TEXT.test(trimmed) ? Number(trimmed) : Number.NaN;
  return isRepsInRange(reps) ? { ok: true, reps } : refuse("reps_whole_1_to_100");
};

/**
 * Reads what the effort field holds. In `rir` mode a whole number from 0 to 10, in `rpe` mode 1 to 10
 * in steps of 0.5 (a comma or a point). A blank entry is valid and is `null`: the set then counts as
 * hard (`setEffort`).
 */
export const parseEffortInput = (text: string, mode: EffortMode): EffortInputResult => {
  const trimmed = text.trim();
  if (trimmed === "") {
    return { ok: true, value: null };
  }
  if (mode === "rir") {
    const rir = WHOLE_NUMBER_TEXT.test(trimmed) ? Number(trimmed) : Number.NaN;
    return isRirInRange(rir) ? { ok: true, value: rir } : refuse("rir_whole_0_to_10");
  }
  const rpe = NUMBER_TEXT.test(trimmed) ? numberOf(trimmed) : Number.NaN;
  return isRpeInRange(rpe) ? { ok: true, value: rpe } : refuse("rpe_1_to_10_in_halves");
};

/**
 * Cleans a set draft. Returns the numbers to log, or one issue for every bad field so that a screen
 * can mark them all at once, in the order load, reps, RIR, RPE. Only the measure the setting uses may
 * be filled: the other one filled is an `effort_one_measure_only` issue on that other field.
 */
export const validateSetDraft = (draft: SetDraft, options: SetDraftOptions): SetDraftResult => {
  const { unit, effortMode } = options;
  const load = parseLoadInput(draft.load, unit);
  const reps = parseRepsInput(draft.reps);
  const effort = parseEffortInput(draft[effortMode], effortMode);
  const otherMeasureFilled = draft[effortMode === "rir" ? "rpe" : "rir"].trim() !== "";

  if (load.ok && reps.ok && effort.ok && !otherMeasureFilled) {
    return {
      ok: true,
      values: {
        setType: draft.setType,
        loadKg: load.kg,
        reps: reps.reps,
        rir: effortMode === "rir" ? effort.value : null,
        rpe: effortMode === "rpe" ? effort.value : null,
      },
    };
  }

  const effortIssue = (field: EffortMode): SetDraftIssue | null => {
    if (field === effortMode) {
      return effort.ok ? null : { field, rule: effort.rule };
    }
    return otherMeasureFilled ? { field, rule: "effort_one_measure_only" } : null;
  };
  const issues: SetDraftIssue[] = [];
  if (!load.ok) {
    issues.push({ field: "load", rule: load.rule });
  }
  if (!reps.ok) {
    issues.push({ field: "reps", rule: reps.rule });
  }
  for (const field of ["rir", "rpe"] as const) {
    const issue = effortIssue(field);
    if (issue !== null) {
      issues.push(issue);
    }
  }
  return { ok: false, issues };
};

/**
 * The rules cleaned numbers break, one issue per bad field, for the code that builds a row from values
 * it was handed rather than text. Not exported from the package.
 */
export const setValueIssues = (values: SetValues): SetDraftIssue[] => {
  const issues: SetDraftIssue[] = [];
  if (values.loadKg !== null && !isLoadInRange(values.loadKg)) {
    issues.push({ field: "load", rule: "load_0_to_1000_kg" });
  }
  if (!isRepsInRange(values.reps)) {
    issues.push({ field: "reps", rule: "reps_whole_1_to_100" });
  }
  if (values.rir !== null && !isRirInRange(values.rir)) {
    issues.push({ field: "rir", rule: "rir_whole_0_to_10" });
  }
  if (values.rpe !== null && !isRpeInRange(values.rpe)) {
    issues.push({ field: "rpe", rule: "rpe_1_to_10_in_halves" });
  }
  if (values.rir !== null && values.rpe !== null) {
    issues.push({ field: "rpe", rule: "effort_one_measure_only" });
  }
  return issues;
};

/**
 * Cleaned numbers written back as the text a form holds, in the person's unit: the inverse of
 * `validateSetDraft` for the RIR measure. The effort is the RIR alone, since RPE has no screen.
 */
export const setDraftOfValues = (values: SetValues, unit: LoadUnit): SetDraft => ({
  setType: values.setType,
  load: values.loadKg === null ? "" : displayLoad(values.loadKg, unit),
  reps: String(values.reps),
  rir: values.rir === null ? "" : String(values.rir),
  rpe: "",
});
