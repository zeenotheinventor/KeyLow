// @not-in-barrel Internal to the copy: the session modules use it, and it is not part of @keylow/core/copy.
import { describeCount } from "./counts";
import { displayLoad } from "../training/loads";

import type { SetType } from "../training/enums";
import type { LoadUnit } from "../training/loads";

/*
 * Small helpers the session copy modules share. Not exported from the copy index: they are not sentences.
 */

/**
 * A name as it reads in the middle of a sentence: its first letter lowercased, as the boards write
 * "leg press set 3". A first word with a second capital in it is an acronym ("EZ bar curl") and keeps them.
 */
export const lowerFirst = (name: string): string => {
  const [firstWord = ""] = name.split(" ");
  const isAcronym = /\p{Lu}/u.test(firstWord.slice(1));
  return isAcronym ? name : name.charAt(0).toLowerCase() + name.slice(1);
};

const UNIT_WORDS: Readonly<Record<LoadUnit, Readonly<{ singular: string; plural: string }>>> = {
  kg: { singular: "kilogram", plural: "kilograms" },
  lb: { singular: "pound", plural: "pounds" },
};

/** A load as it is spoken: "180 kilograms", "1 pound". */
export const spokenLoad = (loadKg: number, unit: LoadUnit): string => {
  const shown = displayLoad(loadKg, unit);
  const words = UNIT_WORDS[unit];
  return `${shown} ${shown === "1" ? words.singular : words.plural}`;
};

export const spokenReps = (reps: number): string => describeCount(reps, "rep", "reps");

/** A set's numbers as they are spoken, leaving out a load or an RIR that was not entered. */
export const spokenNumbers = (
  { loadKg, reps, rir }: Readonly<{ loadKg: number | null; reps: number; rir?: number | null }>,
  unit: LoadUnit,
): string[] => [
  ...(loadKg === null ? [] : [spokenLoad(loadKg, unit)]),
  spokenReps(reps),
  ...(rir === undefined || rir === null ? [] : [`RIR ${rir}`]),
];

/**
 * A set's numbers as they are written: "170 × 12", or "10 reps" for a set with no load. A sentence adds the
 * unit to the load ("170 kg × 12"), and a row does not, since its column heading has it.
 */
export const writtenNumbers = (
  { loadKg, reps }: Readonly<{ loadKg: number | null; reps: number }>,
  unit: LoadUnit,
  loadSuffix: string,
): string =>
  loadKg === null ? spokenReps(reps) : `${displayLoad(loadKg, unit)}${loadSuffix} × ${reps}`;

/** What a set is called on a row and in the sheet, given its number among the working sets. */
export const SET_PHRASES: Record<SetType, (setNumber: number) => string> = {
  warmup: () => "Warm-up set",
  working: (setNumber) => `Set ${setNumber}`,
  drop: () => "Drop set",
  failure: () => "Failure set",
};

/** The mark at the start of a set's row, as the session set types board draws them. */
export const SET_MARKS: Record<SetType, (setNumber: number) => string> = {
  warmup: () => "W",
  working: (setNumber) => String(setNumber),
  drop: () => "D",
  failure: () => "F",
};
