/** The shortest height accepted, in centimetres, inclusive. */
export const HEIGHT_MIN_CM = 100;

/** The tallest height accepted, in centimetres, inclusive. */
export const HEIGHT_MAX_CM = 250;

const CENTIMETRES_PER_INCH = 2.54;
const INCHES_PER_FOOT = 12;
const MOST_DECIMAL_DIGITS = 1;
const HUNDREDTHS = 100;

export type HeightReason = "not-a-number" | "too-low" | "too-high";

export type HeightInputReason =
  HeightReason | "empty" | "too-many-decimals" | "inches-out-of-range";

export type HeightInput =
  | Readonly<{ unit: "cm"; text: string }>
  | Readonly<{ unit: "ft_in"; feet: string; inches: string }>;

export type HeightInputResult =
  Readonly<{ ok: true; heightCm: number }> | Readonly<{ ok: false; reason: HeightInputReason }>;

export type HeightCheck = Readonly<{ ok: true }> | Readonly<{ ok: false; reason: HeightReason }>;

// Same rules as `parseWeightInput` in the weight module: digits with at most one decimal comma or point,
// and an optional sign so that "-5" reads as too low.
const NUMBER_TEXT = /^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/;
const WHOLE_NUMBER_TEXT = /^\d+$/;
const DECIMAL_SEPARATOR = /[.,]/;
const TRAILING_ZEROS = /0+$/;

/** Whether a height in centimetres is a number inside the bounds. A reason is a code and holds no value. */
export function checkHeightCm(heightCm: number): HeightCheck {
  if (!Number.isFinite(heightCm)) {
    return { ok: false, reason: "not-a-number" };
  }
  if (heightCm < HEIGHT_MIN_CM) {
    return { ok: false, reason: "too-low" };
  }
  if (heightCm > HEIGHT_MAX_CM) {
    return { ok: false, reason: "too-high" };
  }
  return { ok: true };
}

function withinBounds(heightCm: number): HeightInputResult {
  const check = checkHeightCm(heightCm);
  return check.ok ? { ok: true, heightCm } : check;
}

function parseCentimetres(text: string): HeightInputResult {
  const trimmed = text.trim();

  if (trimmed === "") {
    return { ok: false, reason: "empty" };
  }
  if (!NUMBER_TEXT.test(trimmed)) {
    return { ok: false, reason: "not-a-number" };
  }

  const decimals = (trimmed.split(DECIMAL_SEPARATOR)[1] ?? "").replace(TRAILING_ZEROS, "");
  if (decimals.length > MOST_DECIMAL_DIGITS) {
    return { ok: false, reason: "too-many-decimals" };
  }
  return withinBounds(Number(trimmed.replace(",", ".")));
}

function parseFeetAndInches(feetText: string, inchesText: string): HeightInputResult {
  const feet = feetText.trim();
  const inches = inchesText.trim();

  if (feet === "" || inches === "") {
    return { ok: false, reason: "empty" };
  }
  if (!WHOLE_NUMBER_TEXT.test(feet) || !WHOLE_NUMBER_TEXT.test(inches)) {
    return { ok: false, reason: "not-a-number" };
  }
  if (Number(inches) >= INCHES_PER_FOOT) {
    return { ok: false, reason: "inches-out-of-range" };
  }

  const totalInches = Number(feet) * INCHES_PER_FOOT + Number(inches);
  // Whole inches are whole hundredths of a centimetre, so rounding only removes floating point noise.
  return withinBounds(Math.round(totalInches * CENTIMETRES_PER_INCH * HUNDREDTHS) / HUNDREDTHS);
}

const SHORTEST_ACCEPTED_INCHES = Math.ceil(HEIGHT_MIN_CM / CENTIMETRES_PER_INCH);

/**
 * A height in centimetres as whole feet and whole inches, the nearest whole inch, for the fields to show.
 * The result is never an inch that `parseHeightInput` refuses, so 100 cm reads 3 ft 4 in rather than the
 * 3 ft 3 in that is a hair under the shortest height. Meant for a height that has passed `checkHeightCm`.
 */
export function centimetresToFeetAndInches(heightCm: number): { feet: number; inches: number } {
  const totalInches = Math.max(
    Math.round(heightCm / CENTIMETRES_PER_INCH),
    SHORTEST_ACCEPTED_INCHES,
  );
  return { feet: Math.floor(totalInches / INCHES_PER_FOOT), inches: totalInches % INCHES_PER_FOOT };
}

/**
 * Reads what the height fields hold, in centimetres (a decimal comma or point, one decimal at most)
 * or in whole feet and whole inches (0 to 11), and returns the height in centimetres or the reason
 * it cannot be used. A reason is a code and states the rule only, because the text is health data.
 * Trailing zeros do not count, so "180.50" reads as 180.5 and "180.55" is too many decimals.
 */
export function parseHeightInput(input: HeightInput): HeightInputResult {
  return input.unit === "cm"
    ? parseCentimetres(input.text)
    : parseFeetAndInches(input.feet, input.inches);
}
