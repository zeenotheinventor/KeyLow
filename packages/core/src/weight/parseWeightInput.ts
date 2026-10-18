import { WEIGH_IN_MAX_KG, WEIGH_IN_MIN_KG } from "./bounds";

export type WeightInputReason =
  "empty" | "not-a-number" | "too-many-decimals" | "too-low" | "too-high";

export type WeightInputResult =
  Readonly<{ ok: true; weightKg: number }> | Readonly<{ ok: false; reason: WeightInputReason }>;

// Digits with at most one decimal comma or point, and an optional sign so that "-5" reads as too low.
const NUMBER_TEXT = /^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/;
const DECIMAL_SEPARATOR = /[.,]/;
const TRAILING_ZEROS = /0+$/;
const MOST_DECIMAL_DIGITS = 1;

function refuse(reason: WeightInputReason): WeightInputResult {
  return { ok: false, reason };
}

/**
 * Reads what the weight field holds: a decimal comma or point, spaces around, kilograms. Returns the
 * weight or the reason it cannot be used. A reason is a code and states the rule only, because the
 * text is health data and must not reach a log. The bounds are inclusive and one decimal is the most
 * the entry sheet allows. Trailing zeros do not count, so "81.40" reads as 81.4 and "81.45" is refused
 * as too many decimals.
 */
export function parseWeightInput(text: string): WeightInputResult {
  const trimmed = text.trim();

  if (trimmed === "") {
    return refuse("empty");
  }
  if (!NUMBER_TEXT.test(trimmed)) {
    return refuse("not-a-number");
  }

  const decimals = (trimmed.split(DECIMAL_SEPARATOR)[1] ?? "").replace(TRAILING_ZEROS, "");
  if (decimals.length > MOST_DECIMAL_DIGITS) {
    return refuse("too-many-decimals");
  }

  const weightKg = Number(trimmed.replace(",", "."));
  if (weightKg < WEIGH_IN_MIN_KG) {
    return refuse("too-low");
  }
  if (weightKg > WEIGH_IN_MAX_KG) {
    return refuse("too-high");
  }
  return { ok: true, weightKg };
}
