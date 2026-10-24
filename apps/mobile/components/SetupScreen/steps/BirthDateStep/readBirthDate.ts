import { checkBirthDate } from "@keylow/core/setup";

import type { BirthDateFieldTexts, BirthDateReading } from "./types";

const ONE_OR_TWO_DIGITS = /^\d{1,2}$/;
const FOUR_DIGITS = /^\d{4}$/;

const padToTwoDigits = (text: string): string => text.padStart(2, "0");

/**
 * What the three fields hold, as a birth date to use, nothing yet, or the reason it cannot be used. A
 * date that is only half typed is not a real date, so it reads as that reason, and the screen decides
 * when to say so. `today` is a `YYYY-MM-DD` in the device's time zone.
 */
export function readBirthDate(fields: BirthDateFieldTexts, today: string): BirthDateReading {
  const { day, month, year } = fields;
  if (day === "" && month === "" && year === "") {
    return { kind: "empty" };
  }
  if (!ONE_OR_TWO_DIGITS.test(day) || !ONE_OR_TWO_DIGITS.test(month) || !FOUR_DIGITS.test(year)) {
    return { kind: "problem", reason: "not-a-date" };
  }

  const birthDate = `${year}-${padToTwoDigits(month)}-${padToTwoDigits(day)}`;
  const result = checkBirthDate(birthDate, today);
  return result.ok ? { kind: "valid", birthDate } : { kind: "problem", reason: result.reason };
}
