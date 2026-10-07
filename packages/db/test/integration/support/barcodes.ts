import { randomInt } from "node:crypto";

// GS1 reserves the prefix 2 for restricted circulation (in-store codes), so a generated code is
// never a real product, and it cannot collide with a row the OFF seed adds later.
const RESTRICTED_CIRCULATION_PREFIX = "2";

// Every code generated since the last drain, so a test file can delete the rows it created.
const generatedBarcodes: string[] = [];

// Weights 3 and 1 from the right of the body, as in the GTIN check digit rule.
function checkDigitOf(body: string): number {
  const weightedSum = Array.from(body, Number)
    .reverse()
    .reduce((sum, digit, position) => sum + digit * (position % 2 === 0 ? 3 : 1), 0);
  return (10 - (weightedSum % 10)) % 10;
}

/** A valid EAN-13 from a random prefix, so parallel runs and reruns never share a code. */
export function generateBarcode(): string {
  const randomDigits = Array.from({ length: 11 }, () => randomInt(10)).join("");
  const body = `${RESTRICTED_CIRCULATION_PREFIX}${randomDigits}`;
  const code = `${body}${checkDigitOf(body)}`;
  generatedBarcodes.push(code);
  return code;
}

/** Returns every code generated since the last drain, and forgets them. */
export function drainGeneratedBarcodes(): string[] {
  return generatedBarcodes.splice(0);
}
