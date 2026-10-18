import { roundToGram } from "../weight/roundToGram";
import { displayWeight, lbToKg } from "../weight/units";

import type { WeightDisplayUnit } from "../weight/types";

/** The units a load is typed and shown in. Storage is always kilograms. */
export type LoadUnit = WeightDisplayUnit;

/**
 * A load as stored: kilograms in whole grams, whichever unit it was typed in. Pounds go through
 * `lbToKg` first. Never a negative zero.
 */
export const loadToKg = (value: number, unit: LoadUnit): number =>
  roundToGram(unit === "lb" ? lbToKg(value) : value) + 0;

/** A stored load as the screen shows it: one decimal of the unit at most, and no trailing `.0`. */
export const displayLoad = (kilograms: number, unit: LoadUnit): string =>
  String(displayWeight(kilograms, unit));
