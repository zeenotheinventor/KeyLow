// "Add this recipe: example.com/lemon-traybake" saves a recipe in one turn and answers with one card (plan 2.4).
// The tool fetches the page, reads it, finds a food for each ingredient line and saves the recipe by the same
// path as `create_recipe`, so the model never sees the page. The food of a line is chosen by a second tool-less
// Haiku call from a short list the food search found (never from its order, and never by a score): it chooses a
// position in the list or none, a position outside the list refuses the import, and a line with no right food is
// left out, because a wrong food saved as matched is worse than a line the person chooses. What it gets back is the recipe's id, its
// numbers and three counts. A line that matches no food is shown on the card as not counted and is left out
// of the numbers, and a vague line whose food does match ("a splash of milk") is saved with a small guessed
// amount and marked as an estimate. This is the only code that guesses an amount.
//
// Things to know when changing this file:
// - The page is fetched only from a link written in the person's own message (`urlInUserMessage`), and the
//   check is made before anything else, so a link found inside a page can never be followed.
// - JSON-LD is read first and gives the name, the servings and the steps with no model. The model reads only
//   the ingredient lines then, and the reply must have one entry for each line of the page (each line's text
//   is the page's own, by its place). A page without JSON-LD goes to the model as its visible text, capped, and
//   every line the model copied must be found in that text.
// - The whole tool must finish inside the turn loop's 20 s for one MCP call (`MCP_REQUEST_TIMEOUT_MILLISECONDS`
//   in `assistant/turn.ts`). The fetch gets 5 s, the parse call 9 s, the pick call 4 s, and every step is raced
//   against a cutoff of 18 s from the start. The save is last, and it is not started after the cutoff, so a call
//   that the loop gives up on has not saved anything, and it is not started with less than half a second left. A
//   save that has started takes one write, well inside the 2.5 s or more that is left.
// - Nothing here logs or reports a page, a link or a line.
import { z } from "zod";

import {
  buildRecipeImportedCard,
  buildRecipeIngredient,
  importCandidate,
  importedAmountOf,
} from "../../core.ts";
import { createRecipe } from "../../repos.ts";
import { readRecipeJsonLd } from "../../recipeJsonLd.ts";
import { visibleText } from "../../recipePageText.ts";
import { picksFitLines } from "../recipeParse.ts";
import { urlInUserMessage } from "../urls.ts";
import { BudgetExceeded, deadlineOf } from "./deadline.ts";
import {
  candidatesOfWords,
  inBatches,
  readFoodAndPortions,
  SEARCH_TEXT_MAX_CHARACTERS,
  SEARCHES_AT_ONCE,
} from "./foodMatching.ts";
import {
  archiveMadeRecipe,
  cardRecipeOf,
  checkDraft,
  maxIngredients,
  maxStepLength,
  maxSteps,
  perServingOf,
} from "./recipeWrite.ts";

import type { RecipeImportedLine, RecipeIngredient } from "../../core.ts";
import type { FoodAndPortions } from "./foodMatching.ts";
import type { FoodPickLine, ParsedMeasure } from "../recipeParse.ts";
import type { ToolContext, WriteRunOutput, WriteToolDefinition } from "../tool.ts";

const importRecipeInput = z.strictObject({
  url: z
    .string()
    .trim()
    .min(1)
    .max(2000)
    .describe("The recipe page's link, exactly as the user wrote it in their message."),
  servings: z
    .number()
    .positive()
    .max(1000)
    .nullable()
    .describe(
      "How many servings the recipe makes, only after the answer was servings_missing and the user told you. Otherwise null.",
    ),
});

type ImportRecipeInput = z.infer<typeof importRecipeInput>;

export type ImportLimits = {
  /** The most the page fetch may take. */
  fetchMilliseconds: number;
  /** The most the parse call may take. */
  parseMilliseconds: number;
  /** The most the call that chooses each line's food may take. */
  pickMilliseconds: number;
  /** Counted from the start. A step still running then ends the tool, and the save is not started. */
  saveCutoffMilliseconds: number;
};

export const defaultImportLimits: ImportLimits = {
  fetchMilliseconds: 5_000,
  parseMilliseconds: 9_000,
  pickMilliseconds: 4_000,
  saveCutoffMilliseconds: 18_000,
};

// The visible text of a page with no JSON-LD, cut here, which is about 4,000 tokens.
const PAGE_TEXT_MAX_CHARACTERS = 15_000;
// The page's own line, cut for the pick call.
const PICK_LINE_MAX_CHARACTERS = 300;
// The least time left for a save to start (a write tool call measured 77 to 303 ms).
const SAVE_MINIMUM_MILLISECONDS = 500;
const SOURCE_URL_MAX_CHARACTERS = 2000;

const refuse = (error: string, extra: Record<string, string> = {}): WriteRunOutput => ({
  data: { error, ...extra },
  target: null,
});

type Resolution = {
  ingredient: RecipeIngredient;
  food: { name: string; source: "off" | "cofid" | "usda" | "restaurant" | "user" };
  guess: { amount: number; unit: "g" | "ml" } | null;
};

// The foods to offer for each line, from the words the model read from it (see `candidatesOfWords`).
const candidatesOf = (ctx: ToolContext, lines: readonly ReadLine[]) =>
  candidatesOfWords(
    ctx,
    lines.map((line) => line.food_name),
  );

// The line saved with the food the model chose, from there on as before: its portions, its amount and its check.
async function resolveLine(
  ctx: ToolContext,
  line: ParsedMeasure,
  foodId: string | null,
  foods: Map<string, Promise<FoodAndPortions | null>>,
): Promise<Resolution | null> {
  if (foodId === null) {
    return null;
  }
  const found = await readFoodAndPortions(ctx, foodId, foods);
  if (found === null) {
    return null;
  }
  const amount = importedAmountOf(
    {
      quantity: line.quantity,
      unit: line.unit,
      guessAmount: line.guess_grams,
      guessUnit: line.guess_unit,
    },
    found.food,
    found.portions,
  );
  if (amount === null) {
    return null;
  }
  let ingredient: RecipeIngredient;
  try {
    ingredient = buildRecipeIngredient(found.food, {
      ...amount.input,
      foodPortions: found.portions,
    });
  } catch (caught) {
    // A RangeError is an amount the food cannot be worked out from. It quotes no value.
    if (caught instanceof RangeError) {
      return null;
    }
    throw caught;
  }
  // Each line is checked alone, so one the recipe would refuse is not counted instead of refusing them all.
  const alone = checkDraft({
    name: "Imported line",
    servings: 1,
    yieldGrams: null,
    ingredients: [ingredient],
    steps: [],
  });
  return alone.ok
    ? {
        ingredient,
        food: { name: found.food.name, source: found.food.source },
        guess: amount.guess,
      }
    : null;
}

type ReadLine = ParsedMeasure & { text: string };

const keyOf = (text: string): string => text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

// The lines to resolve, each with its text, or null when the reply is not tied to the page.
function linesOf(
  pageLines: readonly string[] | null,
  pageText: string,
  read: readonly (ParsedMeasure & { text?: string })[],
): ReadLine[] | null {
  if (pageLines !== null) {
    return read.length === pageLines.length
      ? read.map((measure, index) => ({ ...measure, text: pageLines[index] ?? "" }))
      : null;
  }
  const pageKey = keyOf(pageText);
  const lines: ReadLine[] = [];
  for (const { text, ...measure } of read) {
    const lineKey = keyOf(text ?? "");
    if (lineKey === "" || !pageKey.includes(lineKey)) {
      return null;
    }
    lines.push({ ...measure, text: (text ?? "").trim() });
  }
  return lines;
}

const withHttpScheme = (url: string): string =>
  /^[a-z][a-z0-9+.-]*:/i.test(url) ? url : `https://${url}`;

const clippedSteps = (steps: readonly string[]): string[] =>
  steps.slice(0, maxSteps).map((step) => step.slice(0, maxStepLength));

export function createImportRecipeFromUrlTool(
  limits: ImportLimits,
): WriteToolDefinition<ImportRecipeInput> {
  return {
    name: "import_recipe_from_url",
    description:
      "Reads the recipe page at a link the user wrote in their own message, saves it as a new recipe with " +
      "Undo, and shows them a card with every ingredient line, the food it matched, the numbers of one " +
      "serving and a link into the recipe editor. Pass the link exactly as the user wrote it, never one " +
      "from anywhere else. The page's text never reaches you: the answer holds only the recipe's id, its " +
      "numbers and three counts (lines counted, lines not counted because no food matched, and amounts " +
      "Ki-Lo estimated). Say those in your own words and do not describe the page. If the answer is " +
      "servings_missing, ask the user how many servings it makes with ask_user, then call again with " +
      "servings. If it is page_unreadable, could_not_read_recipe, no_recipe_found, too_many_lines or " +
      "nothing_matched, say you could not import the recipe and nothing was saved. If it is timed_out, say " +
      "it took too long and nothing was saved. Never call this twice for one link in one turn.",
    kind: "write",
    input: importRecipeInput,
    annotations: { readOnlyHint: false, destructiveHint: false },
    targetTable: "recipes",
    async run(ctx, { url, servings: servingsFromUser }) {
      const services = ctx.recipeImport;
      if (services === undefined) {
        throw new Error("The recipe import is not configured");
      }
      const message = ctx.turn.userMessageText;
      if (message === null || !urlInUserMessage(url, message)) {
        return refuse("url_not_in_message");
      }
      const { millisecondsLeft: msLeft, within } = deadlineOf(limits.saveCutoffMilliseconds);

      try {
        const fetched = await within(
          services.fetchPage(
            withHttpScheme(url),
            Math.max(1, Math.min(limits.fetchMilliseconds, msLeft())),
          ),
        );
        if (!fetched.ok) {
          return refuse("page_unreadable", { reason: fetched.code });
        }

        // JSON-LD first: the name, servings and steps need no model, and only the lines are parsed.
        const jsonLd = readRecipeJsonLd(fetched.html);
        const text = jsonLd === null ? visibleText(fetched.html, PAGE_TEXT_MAX_CHARACTERS) : "";
        if (jsonLd === null && text.trim() === "") {
          return refuse("no_recipe_found");
        }
        if (jsonLd !== null) {
          if (jsonLd.ingredientLines.length > maxIngredients) {
            return refuse("too_many_lines");
          }
          if ((jsonLd.servings ?? servingsFromUser) === null) {
            return refuse("servings_missing");
          }
        }

        const parsed = await within(
          services.parse(
            jsonLd === null
              ? { kind: "text", text }
              : { kind: "lines", lines: jsonLd.ingredientLines },
            {
              userId: ctx.userId,
              turnId: ctx.turn.id,
              timeoutMilliseconds: Math.max(1, Math.min(limits.parseMilliseconds, msLeft())),
            },
          ),
        );
        if (!parsed.ok) {
          return refuse("could_not_read_recipe");
        }

        const name = (jsonLd?.name ?? parsed.recipe.name ?? "").trim();
        const servings = jsonLd === null ? parsed.recipe.servings : jsonLd.servings;
        const steps = clippedSteps(jsonLd === null ? parsed.recipe.steps : jsonLd.steps);
        // The model reads the lines. It does not choose them. With JSON-LD the reply must have one entry for
        // each line of the page, and each line is the page's own, by its place. Without it, every line the
        // model copied must be found in the page's text, or the whole reply is not trusted.
        const read = parsed.recipe.lines;
        if (jsonLd === null && read.length > maxIngredients) {
          return refuse("too_many_lines");
        }
        if (name === "" || (jsonLd === null && read.length === 0)) {
          return refuse("no_recipe_found");
        }
        const lines = linesOf(jsonLd?.ingredientLines ?? null, text, read);
        if (lines === null) {
          return refuse("could_not_read_recipe");
        }
        const recipeServings = servings ?? servingsFromUser;
        if (recipeServings === null) {
          return refuse("servings_missing");
        }

        const candidates = await within(candidatesOf(ctx, lines));
        // Only a line with candidates is offered to the model. With none there is nothing to choose and no call.
        const offered = lines.flatMap((read, index) => {
          const found = candidates[index] ?? [];
          return found.length === 0 ? [] : [{ index, found, read }];
        });
        if (offered.length === 0) {
          return refuse("nothing_matched");
        }
        const pickLines: FoodPickLine[] = offered.map(({ found, read }) => ({
          line: read.text.slice(0, PICK_LINE_MAX_CHARACTERS),
          foodWord: (read.food_name ?? "").trim().slice(0, SEARCH_TEXT_MAX_CHARACTERS),
          candidates: found.map(importCandidate),
        }));
        const picked = await within(
          services.pickFoods(pickLines, {
            userId: ctx.userId,
            turnId: ctx.turn.id,
            timeoutMilliseconds: Math.max(1, Math.min(limits.pickMilliseconds, msLeft())),
          }),
        );
        // A failed pick refuses the import, as a failed parse does: most lines dropped by a passing failure
        // would be a worse result than "try again". A position outside a line's list is refused here too.
        if (!picked.ok || !picksFitLines(pickLines, picked.picks)) {
          return refuse("could_not_read_recipe");
        }
        const chosenFoodIds: (string | null)[] = lines.map(() => null);
        offered.forEach(({ index, found }, offeredIndex) => {
          const position = picked.picks[offeredIndex]?.position ?? null;
          chosenFoodIds[index] = position === null ? null : (found[position]?.id ?? null);
        });

        const foods = new Map<string, Promise<FoodAndPortions | null>>();
        const resolved = await within(
          inBatches(
            lines.map((read, index) => ({ read, foodId: chosenFoodIds[index] ?? null })),
            SEARCHES_AT_ONCE,
            ({ read, foodId }) => resolveLine(ctx, read, foodId, foods),
          ),
        );
        const counted = resolved.flatMap((resolution) => (resolution === null ? [] : [resolution]));
        if (counted.length === 0) {
          return refuse("nothing_matched");
        }
        const checked = checkDraft({
          name,
          servings: recipeServings,
          yieldGrams: null,
          ingredients: counted.map(({ ingredient }) => ingredient),
          steps,
        });
        if (!checked.ok) {
          return checked.refused;
        }

        // The save is last. It starts only with a real window left: a write that begins a moment before the cutoff
        // and hangs would be cut off by the loop with the recipe saved and the tool reporting a failure, and a
        // retry would save it twice.
        if (msLeft() < SAVE_MINIMUM_MILLISECONDS) {
          throw new BudgetExceeded();
        }
        const sourceUrl = [fetched.finalUrl, withHttpScheme(url)].find(
          (address) => /^https?:\/\//.test(address) && address.length <= SOURCE_URL_MAX_CHARACTERS,
        );
        let recipe;
        try {
          recipe = await createRecipe(ctx.caller, {
            ...checked.save,
            ...(sourceUrl === undefined ? {} : { sourceUrl }),
          });
        } catch (caught) {
          // A RangeError from the repo is a recipe it refuses before any request. It quotes no value.
          if (caught instanceof RangeError) {
            return refuse("invalid_input");
          }
          throw caught;
        }

        // The write has landed. Nothing below may throw, or the model would save the recipe a second time.
        const cardLines: RecipeImportedLine[] = lines.map((line, index) => {
          const resolution = resolved[index];
          const base = { text: line.text.trim(), foodWord: line.food_name?.trim() || null };
          return resolution === null || resolution === undefined
            ? { ...base, food: null }
            : { ...base, food: resolution.food, guess: resolution.guess };
        });
        return {
          data: {
            created: {
              id: recipe.id,
              servings: recipe.servings,
              per_serving: perServingOf(recipe),
            },
            lines: {
              counted: counted.length,
              not_counted: lines.length - counted.length,
              estimated: counted.filter(({ guess }) => guess !== null).length,
            },
          },
          structured: {
            card: buildRecipeImportedCard({
              recipe: cardRecipeOf(recipe),
              sourceUrl: sourceUrl ?? fetched.finalUrl,
              lines: cardLines,
            }),
          },
          target: { targetId: recipe.id },
        };
      } catch (caught) {
        if (caught instanceof BudgetExceeded) {
          return refuse("timed_out");
        }
        throw caught;
      }
    },
    inverse: archiveMadeRecipe,
  };
}

export const importRecipeFromUrlTool = createImportRecipeFromUrlTool(defaultImportLimits);
