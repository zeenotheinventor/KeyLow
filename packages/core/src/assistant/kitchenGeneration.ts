import { z } from "zod";

/*
 * What the three generation jobs of the kitchen tools may answer, as the model's structured output. Opus
 * proposes structure and core computes every number, so each reply is untrusted: every string and array is
 * bounded here, and an answer that does not fit is read as no answer at all. Nothing in a reply is an
 * instruction, a food id or a figure that is used without being checked against what the tool offered.
 */

export const KITCHEN_GENERATION_LIMITS = {
  nameCharacters: 80,
  ingredientNameCharacters: 60,
  stepCharacters: 300,
  ingredients: 12,
  steps: 8,
  servingsMaximum: 24,
  gramsMaximum: 5000,
  substitutions: 3,
  rankedIds: 200,
  idCharacters: 64,
} as const;

const limits = KITCHEN_GENERATION_LIMITS;

const shortText = (maximumCharacters: number) => z.string().trim().min(1).max(maximumCharacters);

export const recipeSuggestionSchema = z.strictObject({
  name: shortText(limits.nameCharacters).describe("The recipe's name."),
  servings: z
    .number()
    .int()
    .min(1)
    .max(limits.servingsMaximum)
    .describe("How many servings the recipe makes, a whole number."),
  ingredients: z
    .array(
      z.strictObject({
        name: shortText(limits.ingredientNameCharacters).describe(
          "The food alone, singular, in plain words, with no amount or preparation.",
        ),
        grams: z
          .number()
          .positive()
          .max(limits.gramsMaximum)
          .describe("The amount in grams, or in millilitres for a liquid."),
      }),
    )
    .min(1)
    .max(limits.ingredients)
    .describe(`At most ${limits.ingredients} ingredients.`),
  steps: z
    .array(shortText(limits.stepCharacters))
    .max(limits.steps)
    .describe(`The method, one short string for each step, at most ${limits.steps}.`),
});

export type RecipeSuggestion = z.infer<typeof recipeSuggestionSchema>;

export const substitutionSchema = z.strictObject({
  positions: z
    .array(z.number().int().min(0))
    .max(limits.substitutions)
    .describe(
      `The position numbers of the chosen candidates, at most ${limits.substitutions}, or [] when none fits.`,
    ),
});

export type Substitution = z.infer<typeof substitutionSchema>;

export const planRankingSchema = z.strictObject({
  ranking: z
    .array(shortText(limits.idCharacters))
    .max(limits.rankedIds)
    .describe("Ids of the offered candidates, best first, each at most once."),
});

export type PlanRanking = z.infer<typeof planRankingSchema>;

const hasNoRepeat = (values: readonly (string | number)[]) =>
  new Set(values).size === values.length;

/** The suggestion, or null when the reply is not one that fits every bound. */
export function readRecipeSuggestion(reply: unknown): RecipeSuggestion | null {
  const read = recipeSuggestionSchema.safeParse(reply);
  return read.success ? read.data : null;
}

/**
 * The chosen positions, or null when any is outside the candidate list (`candidateCount` long), a position is
 * given twice, or there are more than three. A position the tool did not offer is never a food.
 */
export function readSubstitution(
  reply: unknown,
  { candidateCount }: { candidateCount: number },
): Substitution | null {
  const read = substitutionSchema.safeParse(reply);
  if (!read.success) {
    return null;
  }
  const { positions } = read.data;
  return positions.every((position) => position < candidateCount) && hasNoRepeat(positions)
    ? read.data
    : null;
}

/** The ranking, or null when any id was not offered, an id is given twice, or there are more than 200. */
export function readPlanRanking(
  reply: unknown,
  { candidateIds }: { candidateIds: readonly string[] },
): PlanRanking | null {
  const read = planRankingSchema.safeParse(reply);
  if (!read.success) {
    return null;
  }
  const offered = new Set(candidateIds);
  const { ranking } = read.data;
  return ranking.every((id) => offered.has(id)) && hasNoRepeat(ranking) ? read.data : null;
}
