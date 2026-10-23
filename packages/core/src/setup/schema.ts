import { z } from "zod";

import { ageInYears } from "../dates";
import { ACTIVITY_LEVELS, SEXES } from "../engine";
import { WEIGH_IN_MAX_KG, WEIGH_IN_MIN_KG } from "../weight";
import { checkBirthDate } from "./birthDate";
import { goalsAllowed } from "./goals";
import { checkHeightCm } from "./height";
import { RATE_PRESETS_PCT_PER_WEEK } from "./presets";
import { DIET_STYLES, GOALS, HEIGHT_UNITS, PROTEIN_PRESETS } from "./types";

import type { SetupAnswers } from "./types";

/*
 * Every message the schema gives is a code that states the rule and holds no value, because the
 * answers are health data. The copy ticket turns the codes into words.
 */
const INVALID = { error: "invalid" } as const;
const NOT_A_NUMBER = { error: "not-a-number" } as const;

const height = z.number(NOT_A_NUMBER).superRefine((heightCm, context) => {
  const check = checkHeightCm(heightCm);
  if (!check.ok) {
    context.addIssue({ code: "custom", message: check.reason });
  }
});

const weight = z
  .number(NOT_A_NUMBER)
  .refine((weightKg) => weightKg >= WEIGH_IN_MIN_KG, { error: "too-low" })
  .refine((weightKg) => weightKg <= WEIGH_IN_MAX_KG, { error: "too-high" });

/**
 * The schema of a complete set of answers on `today` (`YYYY-MM-DD`), which the birth date rules and
 * the under-18 rule need. The weight and height are the values the wizard stores (kilograms and
 * centimetres), so they carry the bounds and not the decimals rule of the text fields. A goal is
 * refused with `not-allowed-for-age` when `goalsAllowed` does not offer it at the age the birth date
 * gives, and a rate that is not one of the goal's presets is refused as `invalid`.
 */
export function setupAnswersSchemaFor(today: string): z.ZodType<SetupAnswers> {
  return z
    .object({
      sex: z.enum(SEXES, INVALID),
      birthDate: z.string({ error: "not-a-date" }).superRefine((birthDate, context) => {
        const check = checkBirthDate(birthDate, today);
        if (!check.ok) {
          context.addIssue({ code: "custom", message: check.reason });
        }
      }),
      heightCm: height,
      weightKg: weight,
      weightUnit: z.enum(["kg", "lb"], INVALID),
      heightUnit: z.enum(HEIGHT_UNITS, INVALID),
      activity: z.enum(ACTIVITY_LEVELS, INVALID),
      goal: z.enum(GOALS, INVALID),
      ratePctPerWeek: z.number(INVALID),
      proteinPreset: z.enum(PROTEIN_PRESETS, INVALID),
      dietStyle: z.enum(DIET_STYLES, INVALID),
    })
    .superRefine((answers, context) => {
      if (!RATE_PRESETS_PCT_PER_WEEK[answers.goal].includes(answers.ratePctPerWeek)) {
        context.addIssue({ code: "custom", path: ["ratePctPerWeek"], message: "invalid" });
      }
      if (
        checkBirthDate(answers.birthDate, today).ok &&
        !goalsAllowed(ageInYears(answers.birthDate, today)).includes(answers.goal)
      ) {
        context.addIssue({ code: "custom", path: ["goal"], message: "not-allowed-for-age" });
      }
    });
}
