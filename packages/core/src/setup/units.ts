import type { WeightUnit } from "../format";
import type { WeightDisplayUnit } from "../weight";
import type { HeightUnit } from "./types";

const POUND_AND_INCH_REGIONS: ReadonlySet<string> = new Set(["US", "LR", "MM"]);

export type DefaultUnits = Readonly<{ weightUnit: WeightDisplayUnit; heightUnit: HeightUnit }>;

/**
 * The units a first run starts with: pounds and feet and inches in the United States, Liberia and
 * Myanmar, and kilograms and centimetres everywhere else, an unknown region included. The app passes
 * the device region.
 */
export function defaultUnitsForRegion(regionCode: string | null | undefined): DefaultUnits {
  return POUND_AND_INCH_REGIONS.has((regionCode ?? "").toUpperCase())
    ? { weightUnit: "lb", heightUnit: "ft_in" }
    : { weightUnit: "kg", heightUnit: "cm" };
}

/** The height unit that goes with a weight unit: the wizard has one switch, kilograms with centimetres or pounds with feet and inches. */
export const heightUnitFor = (weightUnit: WeightDisplayUnit): HeightUnit =>
  weightUnit === "lb" ? "ft_in" : "cm";

/**
 * The unit the wizard enters the weight in (ADR 0003 Amendment 12): the stored kilograms or pounds as
 * they are, pounds when stones are stored because the wizard does not offer stones, and the region's
 * default when nothing is stored. The database keeps the unit as plain text, so text that is not a
 * weight unit reads as nothing stored.
 */
export function entryWeightUnit(
  storedWeightUnit: string | null,
  regionCode: string | null | undefined,
): WeightDisplayUnit {
  if (storedWeightUnit === "kg" || storedWeightUnit === "lb") {
    return storedWeightUnit;
  }
  return storedWeightUnit === "st" ? "lb" : defaultUnitsForRegion(regionCode).weightUnit;
}

/**
 * The weight unit the wizard writes to the profile: the chosen unit on the first set up, when none is
 * stored, and otherwise undefined, so nothing is written. The wizard never overwrites a stored unit.
 */
export function weightUnitToSave(
  storedWeightUnit: WeightUnit | null,
  chosenUnit: WeightDisplayUnit,
): WeightDisplayUnit | undefined {
  return storedWeightUnit === null ? chosenUnit : undefined;
}
