import { describeRepRange } from "./routines";
import { SET_PHRASES, spokenNumbers, writtenNumbers } from "./sessionWording";
import { lowerFirst } from "./wording";
import { formatScaledCount } from "../format/scaledCount";
import {
  MAX_LOAD_KG,
  MAX_REPS,
  MAX_SETS_PER_SESSION,
  MIN_REPS,
  MAX_RIR,
  MIN_RIR,
} from "../training/bounds";
import { kgToLb } from "../weight/units";

import type { SetType } from "../training/enums";
import type { LoadUnit } from "../training/loads";
import type { SetPrefill } from "../training/prefill";
import type { SetInputRule } from "../training/setInput";

/*
 * The words of the set entry sheet and the set types sheet (KEY-413, canvas version 30), as the boards
 * `session · set-entry`, `session · set-types` and `session · invalid` draw them, except where a doc says no
 * board draws a sentence. Data in, sentence out. A load, a count of reps and an exercise name are health
 * data, so none of these throws with one in its message, and the errors state the rule and never a value.
 * RPE has no board (Zee's ruling 5 on KEY-339), so no sentence here is about RPE.
 */

const SEPARATOR = " · ";

/** The mark at the start of a set's row, which the set types sheet draws on each type's row too. */
export { SET_MARKS } from "./sessionWording";

/** The name of the set entry sheet: "Leg press, set 3". */
export const describeSetEntryName = (
  exerciseName: string,
  setType: SetType,
  setNumber: number,
): string => `${exerciseName}, ${SET_PHRASES[setType](setNumber).toLowerCase()}`;

export type SetEntrySubtitleInput = Readonly<{
  setType: SetType;
  setNumber: number;
  /** The sets the plan asks of the exercise, or null when it has no plan. */
  plannedSets: number | null;
  target: Readonly<{ repMin: number; repMax: number; rir: number | null }> | null;
}>;

const describeTarget = ({ repMin, repMax, rir }: NonNullable<SetEntrySubtitleInput["target"]>) =>
  `target ${describeRepRange(repMin, repMax)} ${repMax === 1 ? "rep" : "reps"}${rir === null ? "" : ` at RIR ${rir}`}`;

/**
 * The line under the sheet's title: "Set 3 of 3 · target 10 to 12 reps at RIR 1". A set past the plan, or
 * of an exercise with no plan, gives its number alone. A warm-up has no target, since it counts for none.
 */
export const describeSetEntrySubtitle = ({
  setType,
  setNumber,
  plannedSets,
  target,
}: SetEntrySubtitleInput): string => {
  const phrase = SET_PHRASES[setType](setNumber);
  const isWithinPlan = plannedSets !== null && setNumber <= plannedSets;
  const head = setType === "working" && isWithinPlan ? `${phrase} of ${plannedSets}` : phrase;
  return setType === "warmup" || target === null
    ? head
    : `${head}${SEPARATOR}${describeTarget(target)}`;
};

/** The four set types, as the set types sheet and the entry sheet's control name them. */
export const SET_TYPE_OPTIONS: Readonly<Record<SetType, Readonly<{ name: string; help: string }>>> =
  {
    warmup: { name: "Warm-up", help: "Never counts toward heat or weekly sets." },
    working: {
      name: "Working",
      help: "Counts by its effort. Left without RIR, it counts as hard.",
    },
    drop: { name: "Drop", help: "A lighter set straight after. Counts like a working set." },
    failure: { name: "Failure", help: "Taken to failure. Counts like a working set." },
  };

export type SetTypeSheetInput = Readonly<{
  exerciseName: string;
  setType: SetType;
  setNumber: number;
}>;

/** The set type sheet's name and the line under its title. */
export const describeSetTypeSheet = ({
  exerciseName,
  setType,
  setNumber,
}: SetTypeSheetInput): Readonly<{ accessibleName: string; subtitle: string }> => {
  const phrase = SET_PHRASES[setType](setNumber).toLowerCase();
  return {
    accessibleName: `Set type, ${lowerFirst(exerciseName)} ${phrase}`,
    subtitle: [exerciseName, phrase, "tap the set number to change it"].join(SEPARATOR),
  };
};

/** The fixed words of the set entry sheet. */
export const SET_ENTRY = {
  setTypeGroupName: "Set type",
  setTypeSheetTitle: "Set type",
  repsLabel: "Reps",
  rirHeading: "RIR, reps in reserve",
  rirHelp: "Optional. Left blank, a working set counts as hard.",
  sameAgainAction: "Same again",
  logSetAction: "Log set",
  /** The line when there is nothing to fill the set from. The boards do not draw it. */
  noHistory: "Nothing logged for this exercise yet.",
  /** The line after a write that failed. The boards do not draw it. */
  saveFailed: "Your set did not save. Check your connection, then try again.",
  /** The line when a set is refused because the session already holds its most sets. The boards do not draw it. */
  sessionFull: `This session holds ${MAX_SETS_PER_SESSION} sets, the most a session can hold.`,
  /** The line after a remove that failed. The boards do not draw it. */
  removeFailed: "Your set was not removed. Check your connection, then try again.",
} as const;

/** The RIR chips. The last one stands for six or more. */
export const RIR_CHIP_LABELS: readonly string[] = ["0", "1", "2", "3", "4", "5", "6+"];

export type SameAgainInput = Readonly<{
  loadKg: number | null;
  reps: number;
  rir: number | null;
  unit: LoadUnit;
}>;

/** The name of the Same again button, with the numbers it repeats: "Same again, 180 kilograms, 11 reps, RIR 1". */
export const describeSameAgainName = ({ unit, ...numbers }: SameAgainInput): string =>
  [SET_ENTRY.sameAgainAction, ...spokenNumbers(numbers, unit)].join(", ");

/**
 * The line under the fields that says where their numbers came from: "Filled from your last set: 180 kg ×
 * 11 at RIR 1. Last week: 170 kg × 10." Numbers from an earlier session say last time, and carry no last
 * week, since they are last week's. With nothing to fill from it says so.
 */
export const describePrefillLine = (
  prefill: SetPrefill,
  lastWeek: Readonly<{ loadKg: number | null; reps: number }> | null,
  unit: LoadUnit,
): string => {
  if (prefill.source === "none") {
    return SET_ENTRY.noHistory;
  }
  const lead = prefill.source === "session" ? "Filled from your last set" : "Filled from last time";
  const numbers = writtenNumbers({ loadKg: prefill.load_kg, reps: prefill.reps }, unit, ` ${unit}`);
  const filled = `${lead}: ${numbers}${prefill.rir === null ? "" : ` at RIR ${prefill.rir}`}.`;
  return prefill.source === "session" && lastWeek !== null
    ? `${filled} Last week: ${writtenNumbers(lastWeek, unit, ` ${unit}`)}.`
    : filled;
};

/**
 * Every rule of KEY-376 that a RIR form can break. The two RPE rules are left out because RPE has no board
 * (ruling 5): a screen that logs RIR never gets them, and one that someday logs RPE adds its words first.
 */
export type WordedSetInputRule = Exclude<
  SetInputRule,
  "rpe_1_to_10_in_halves" | "effort_one_measure_only"
>;

/** Whether a `SetInputRule` has a sentence, so a screen can narrow it before `describeSetInputError`. */
export const isWordedSetInputRule = (rule: SetInputRule): rule is WordedSetInputRule =>
  rule !== "rpe_1_to_10_in_halves" && rule !== "effort_one_measure_only";

const loadRule = (unit: LoadUnit): string => {
  const mostInUnit = unit === "kg" ? MAX_LOAD_KG : Math.floor(kgToLb(MAX_LOAD_KG));
  return `Enter a load from 0 to ${formatScaledCount(mostInUnit)} ${unit}.`;
};

const SET_INPUT_SENTENCES: Record<WordedSetInputRule, (unit: LoadUnit) => string> = {
  load_not_a_number: loadRule,
  load_0_to_1000_kg: loadRule,
  load_ambiguous_separator: () =>
    "Enter the load without a thousands separator, such as 1000, or with a decimal, such as 52.5.",
  reps_whole_1_to_100: () => `Enter whole reps from ${MIN_REPS} to ${MAX_REPS}.`,
  rir_whole_0_to_10: () => `Enter RIR as a whole number from ${MIN_RIR} to ${MAX_RIR}.`,
};

/**
 * The sentence for a rule `validateSetDraft` found. It states the rule and never the value the person
 * typed. The load rule is worded in the person's unit: 1,000 kg is 2,204 lb.
 */
export const describeSetInputError = (rule: WordedSetInputRule, unit: LoadUnit): string =>
  SET_INPUT_SENTENCES[rule](unit);
