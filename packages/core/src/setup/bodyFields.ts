import { displayWeight } from "../weight";
import { centimetresToFeetAndInches, checkHeightCm, parseHeightInput } from "./height";
import { heightUnitFor } from "./units";

import type { WeightDisplayUnit, WeightInputReason } from "../weight";
import type { HeightInputReason, HeightInputResult } from "./height";
import type { HeightUnit } from "./types";

/** What the four fields hold, as typed. Only the fields of the unit on show are read. */
export type BodyFieldTexts = Readonly<{
  centimetres: string;
  feet: string;
  inches: string;
  weight: string;
}>;

export type ProblemReason = HeightInputReason | WeightInputReason;

/** What the person has done to a field, which decides whether its problem is said yet. */
export type FieldHistory = Readonly<{ hasLeft: boolean; hasTyped: boolean }>;

const noTexts: BodyFieldTexts = { centimetres: "", feet: "", inches: "", weight: "" };

/** The height the fields of this unit hold, in centimetres, or the reason it cannot be used. */
export function readHeight(texts: BodyFieldTexts, unit: HeightUnit): HeightInputResult {
  return unit === "cm"
    ? parseHeightInput({ unit: "cm", text: texts.centimetres })
    : parseHeightInput({ unit: "ft_in", feet: texts.feet, inches: texts.inches });
}

/**
 * The fields' text for a height and a weight in centimetres and kilograms, in the unit on show: the height
 * to a tenth of a centimetre or in whole feet and inches, and the weight to one decimal. A height outside
 * the bounds is shown as it is in centimetres, so its problem can be said, and left empty in feet and
 * inches, which could only show it as a different, usable height.
 */
export function fieldTextsOf(
  { heightCm, weightKg }: { heightCm: number | undefined; weightKg: number | undefined },
  weightUnit: WeightDisplayUnit,
): BodyFieldTexts {
  const weight = weightKg === undefined ? "" : displayWeight(weightKg, weightUnit).toFixed(1);
  if (heightCm === undefined) {
    return { ...noTexts, weight };
  }
  if (heightUnitFor(weightUnit) === "cm") {
    return { ...noTexts, centimetres: Number(heightCm.toFixed(1)).toString(), weight };
  }
  if (!checkHeightCm(heightCm).ok) {
    return { ...noTexts, weight };
  }
  const { feet, inches } = centimetresToFeetAndInches(heightCm);
  return { ...noTexts, feet: String(feet), inches: String(inches), weight };
}

/**
 * Whether a field's problem is said yet. Nothing is said of an empty field. A number that is too low may
 * be only the start of a longer one, so it waits until the field is left, or until it is a number the
 * person did not type, such as a saved one. Any other problem cannot be mended by typing more, so it is
 * said at once.
 */
export function shouldShowProblem(
  reason: ProblemReason,
  { hasLeft, hasTyped }: FieldHistory,
): boolean {
  if (reason === "empty") {
    return false;
  }
  if (reason === "too-low") {
    return hasLeft || !hasTyped;
  }
  return true;
}
