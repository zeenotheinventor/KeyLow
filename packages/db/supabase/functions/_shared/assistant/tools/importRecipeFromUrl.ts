// "Add this recipe: example.com/lemon-traybake" saves a recipe in one turn and answers with one card (plan 2.4).
// The tool fetches the page, reads it, finds a food for each ingredient line and saves the recipe by the same
// path as `create_recipe`, so the model never sees the page. What it gets back is the recipe's id, its
// numbers and three counts. A line that matches no food is shown on the card as not counted and is left out
// of the numbers, and a vague line whose food does match ("a splash of milk") is saved with a small guessed
// amount and marked as an estimate. This is the only code that guesses an amount.
//
// Things to know when changing this file:
// - The page is fetched only from a link written in the person's own message (`urlInUserMessage`), and the
//   check is made before anything else, so a link found inside a page can never be followed.
// - JSON-LD is read first and gives the name, the servings and the steps with no model. The model reads only
//   the ingredient lines then. A page without JSON-LD goes to the model as its visible text, capped.
// - The whole tool must finish inside the turn loop's 20 s for one MCP call (`MCP_REQUEST_TIMEOUT_MILLISECONDS`
//   in `assistant/turn.ts`). The fetch gets 5 s, the parse call 9 s, and every step is raced against a cutoff
//   of 15 s from the start. The save is last, and it is not started after the cutoff, so a call that the loop
//   gives up on has not saved anything. A save that has started takes one write, well inside the 5 s left.
// - Nothing here logs or reports a page, a link or a line.
import { z } from "zod";

import {
  buildRecipeImportedCard,
  buildRecipeIngredient,
  importedAmountOf,
  isConfidentFoodMatch,
  simplerFoodWord,
} from "../../core.ts";
import { createRecipe, getFood, listFoodPortions, searchFoods } from "../../repos.ts";
import { readRecipeJsonLd } from "../../recipeJsonLd.ts";
import { visibleText } from "../../recipePageText.ts";
import { urlInUserMessage } from "../urls.ts";
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
import type { ParsedLine } from "../recipeParse.ts";
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
  /** Counted from the start. A step still running then ends the tool, and the save is not started. */
  saveCutoffMilliseconds: number;
};

export const defaultImportLimits: ImportLimits = {
  fetchMilliseconds: 5_000,
  parseMilliseconds: 9_000,
  saveCutoffMilliseconds: 15_000,
};

// The visible text of a page with no JSON-LD, cut here, which is about 4,000 tokens.
const PAGE_TEXT_MAX_CHARACTERS = 15_000;
// The most searches at once, so a long ingredient list does not open forty requests together.
const SEARCHES_AT_ONCE = 8;
// Hits asked of the search for one line. Only the first is taken, if it is good enough.
const HITS_PER_SEARCH = 5;
const SEARCH_TEXT_MAX_CHARACTERS = 80;
const SOURCE_URL_MAX_CHARACTERS = 2000;

class BudgetExceeded extends Error {}

const refuse = (error: string, extra: Record<string, string> = {}): WriteRunOutput => ({
  data: { error, ...extra },
  target: null,
});

type Resolution = {
  ingredient: RecipeIngredient;
  food: { name: string; source: "off" | "cofid" | "usda" | "user" };
  guess: { amount: number; unit: "g" | "ml" } | null;
};

// The food of one search text: the first hit, when it scores well enough.
async function confidentHit(ctx: ToolContext, text: string): Promise<string | null> {
  const query = text.slice(0, SEARCH_TEXT_MAX_CHARACTERS).trim();
  const [first] = await searchFoods(ctx.caller, query, HITS_PER_SEARCH);
  return first !== undefined && isConfidentFoodMatch(first.score) ? first.id : null;
}

// The food word, then once more its head noun when that found nothing. No other search is tried.
async function foodIdOf(ctx: ToolContext, foodWord: string): Promise<string | null> {
  const found = await confidentHit(ctx, foodWord);
  if (found !== null) {
    return found;
  }
  const simpler = simplerFoodWord(foodWord);
  return simpler === null ? null : await confidentHit(ctx, simpler);
}

type FoodAndPortions = {
  food: NonNullable<Awaited<ReturnType<typeof getFood>>>;
  portions: Awaited<ReturnType<typeof listFoodPortions>>;
};

async function resolveLine(
  ctx: ToolContext,
  line: ParsedLine,
  foods: Map<string, Promise<FoodAndPortions | null>>,
): Promise<Resolution | null> {
  const foodWord = line.food_name?.trim() ?? "";
  if (foodWord.length < 2) {
    return null;
  }
  const foodId = await foodIdOf(ctx, foodWord);
  if (foodId === null) {
    return null;
  }
  let read = foods.get(foodId);
  if (read === undefined) {
    read = Promise.all([getFood(ctx.caller, foodId), listFoodPortions(ctx.caller, foodId)]).then(
      ([food, portions]) => (food === null || food.deleted_at !== null ? null : { food, portions }),
    );
    foods.set(foodId, read);
  }
  const found = await read;
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

// Runs `work` for every item, at most `limit` at once, and keeps the order.
async function inBatches<Item, Result>(
  items: readonly Item[],
  limit: number,
  work: (item: Item) => Promise<Result>,
): Promise<Result[]> {
  const results: Result[] = [];
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await work(items[index] as Item);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
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
      const startedAt = performance.now();
      const msLeft = () => limits.saveCutoffMilliseconds - (performance.now() - startedAt);
      // Races a step against the cutoff, so a slow step ends the tool and not the turn.
      const within = <T>(work: Promise<T>): Promise<T> => {
        // The step may still end after the cutoff. Its failure then has nobody to tell.
        work.catch(() => {});
        let timer: ReturnType<typeof setTimeout> | undefined;
        const cutoff = new Promise<never>((_resolve, reject) => {
          timer = setTimeout(() => reject(new BudgetExceeded()), Math.max(0, msLeft()));
        });
        return Promise.race([work, cutoff]).finally(() => clearTimeout(timer));
      };

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
        const lines = parsed.recipe.lines.filter((line) => line.text.trim() !== "");
        if (name === "" || lines.length === 0) {
          return refuse("no_recipe_found");
        }
        if (lines.length > maxIngredients) {
          return refuse("too_many_lines");
        }
        const recipeServings = servings ?? servingsFromUser;
        if (recipeServings === null) {
          return refuse("servings_missing");
        }

        const foods = new Map<string, Promise<FoodAndPortions | null>>();
        const resolved = await within(
          inBatches(lines, SEARCHES_AT_ONCE, (line) => resolveLine(ctx, line, foods)),
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

        // The save is last. Past the cutoff the loop may already have given up on this call.
        if (msLeft() <= 0) {
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
