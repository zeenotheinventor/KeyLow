import type { WeightDisplayUnit } from "./types";

/** The international avoirdupois pound, exactly. */
export const KILOGRAMS_PER_POUND = 0.45359237;

export const kgToLb = (kilograms: number): number => kilograms / KILOGRAMS_PER_POUND;

export const lbToKg = (pounds: number): number => pounds * KILOGRAMS_PER_POUND;

/**
 * A stored weight as the screen shows it: a number rounded to one decimal, in kilograms or pounds.
 * Pounds are display only, since entry and storage are in kilograms. Never a negative zero.
 */
export function displayWeight(kilograms: number, unit: WeightDisplayUnit): number {
  const shown = unit === "lb" ? kgToLb(kilograms) : kilograms;

  return Math.round(shown * 10) / 10 + 0;
}
