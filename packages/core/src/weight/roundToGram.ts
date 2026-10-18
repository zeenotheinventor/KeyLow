/**
 * Kilograms rounded to 3 decimals (one gram), half away from zero, the way the `numeric(6,3)` column
 * rounds what it is given. The column reads the decimal text of the number, so this rounds the digits
 * as the number prints, in whole numbers and with no arithmetic on doubles. That keeps 32.0025 at
 * 32.003, where `Math.round(x * 1000) / 1000` gives 32.002, and the double that prints as
 * 215.29749999999999 at 215.297, where re-reading the shifted text would give 215.298.
 * A value that is not finite is returned as it is.
 */
export function roundToGram(kilograms: number): number {
  if (!Number.isFinite(kilograms)) {
    return kilograms;
  }

  // The text of a double is digits with a point, and an exponent for the very small and very large.
  const [mantissa = "0", exponent = "0"] = Math.abs(kilograms).toString().split("e");
  const [whole = "0", fraction = ""] = mantissa.split(".");
  const digits = whole + fraction;
  // How many leading digits make up the whole grams.
  const keep = whole.length + Number(exponent) + 3;

  let grams = keep <= 0 ? 0n : BigInt(digits.padEnd(keep, "0").slice(0, keep));
  if ((keep < 0 ? "0" : (digits[keep] ?? "0")) >= "5") {
    grams += 1n;
  }

  return (kilograms < 0 ? -1 : 1) * Number(`${grams}e-3`);
}
