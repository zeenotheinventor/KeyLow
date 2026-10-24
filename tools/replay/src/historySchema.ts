import { isCalendarDay } from "@keylow/core/dates";
import { ACTIVITY_LEVELS, CALORIE_GOALS, SEXES } from "@keylow/core/engine";
import { z } from "zod";

import { ReplayInputError } from "./replayInputError.ts";

const calendarDay = z.string().refine(isCalendarDay, "must be a date written YYYY-MM-DD");
const aboveZero = z.number().positive("must be above zero");
const wholeKilocalories = z.number().int("must be a whole number");

/** Adds an issue on the `localDate` of every entry whose date an earlier entry already has. */
function refuseRepeatedDates(entries: readonly { localDate: string }[], context: z.RefinementCtx) {
  const seen = new Set<string>();
  entries.forEach(({ localDate }, index) => {
    if (seen.has(localDate)) {
      context.addIssue({
        code: "custom",
        message: "appears more than once",
        path: [index, "localDate"],
      });
    }
    seen.add(localDate);
  });
}

/** The shape of a history file (see the README). M7's export writes this shape for the same tables. */
export const historySchema = z
  .object({
    stats: z.object({
      sex: z.enum(SEXES),
      birthDate: calendarDay,
      heightCm: aboveZero,
      activity: z.enum(ACTIVITY_LEVELS),
    }),
    onboardingWeightKg: aboveZero,
    program: z.object({
      goal: z.enum(CALORIE_GOALS),
      ratePctPerWeek: z.number().min(0, "must not be below zero"),
      proteinGPerKg: aboveZero,
      fatFraction: z.number().min(0, "must not be below zero").max(1, "must not be above one"),
      dowOffsetsKcal: z.tuple([
        wholeKilocalories,
        wholeKilocalories,
        wholeKilocalories,
        wholeKilocalories,
        wholeKilocalories,
        wholeKilocalories,
        wholeKilocalories,
      ]),
      startedOn: calendarDay,
    }),
    weighIns: z
      .array(z.object({ localDate: calendarDay, weightKg: aboveZero }))
      .superRefine(refuseRepeatedDates),
    days: z
      .array(
        z.object({
          localDate: calendarDay,
          kcal: z.number().min(0, "must not be below zero"),
          isComplete: z.boolean(),
        }),
      )
      .superRefine(refuseRepeatedDates),
  })
  .superRefine(({ stats, program }, context) => {
    if (stats.birthDate > program.startedOn) {
      context.addIssue({
        code: "custom",
        message: "must not be after program.startedOn",
        path: ["stats", "birthDate"],
      });
    }
  });

export type History = z.infer<typeof historySchema>;

/** `weighIns[1].localDate`: the path of an issue in the notation of the README. */
function describePath(path: readonly PropertyKey[]): string {
  if (path.length === 0) {
    return "The history";
  }
  return path.reduce<string>(
    (text, key) =>
      typeof key === "number"
        ? `${text}[${key}]`
        : `${text}${text === "" ? "" : "."}${String(key)}`,
    "",
  );
}

/**
 * Reads a history file's text. A problem is a `ReplayInputError` with a line for each wrong field, each
 * naming the field and what is wrong with it. No line quotes a value, so a date of birth or a weight never
 * reaches the terminal through an error.
 */
export function parseHistory(text: string): History {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new ReplayInputError("The history file is not valid JSON.");
  }
  const result = historySchema.safeParse(json);
  if (!result.success) {
    throw new ReplayInputError(
      result.error.issues
        .map((issue) => `${describePath(issue.path)}: ${issue.message}`)
        .join("\n"),
    );
  }
  return result.data;
}
