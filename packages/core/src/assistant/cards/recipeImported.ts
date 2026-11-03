import { recipeEditorLink } from "./recipeCreated";
import {
  IMPORT_LINE_NOT_COUNTED,
  describeChooseFoodFor,
  describeGuessedAmount,
  describeImportedFrom,
  describeMatchedImportLine,
  describePerServing,
  describeRecipeCreatedTitle,
} from "../../copy/assistantRecipeCards";

import type { AssistantCardDraft } from "./entryCardEntry";
import type { RecipeCardRecipe } from "./recipeCreated";
import type { FoodSource } from "../../schemas/food";
import type { AssistantCardRow } from "../card";

/**
 * One ingredient line of an imported page. `text` is the line as the page wrote it. `foodWord` is the food the
 * import read in it, and opens the editor's search for a line that matched no food. `guess` is set only when the
 * import guessed the amount of a vague line ("a splash of milk"), in grams or millilitres.
 */
export type RecipeImportedLine = {
  text: string;
  foodWord: string | null;
} & (
  | {
      food: { name: string; source: FoodSource };
      guess: { amount: number; unit: "g" | "ml" } | null;
    }
  | { food: null }
);

export type RecipeImportedCardInput = {
  /** The saved recipe, with the numbers core worked out from the lines that matched a food. */
  recipe: RecipeCardRecipe;
  /** The page's final address, the one saved on the recipe. */
  sourceUrl: string;
  lines: readonly RecipeImportedLine[];
};

// The most the editor's search takes (`searchTextSchema`).
const EDITOR_SEARCH_MAX_CHARACTERS = 80;
// A phrase longer than this is not worth printing as the reason for a guess.
const GUESS_PHRASE_MAX_CHARACTERS = 30;

const escapeForPattern = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * What the line said about the amount, in its own words and lower case: the line without its food, and
 * without the "of" that joined them ("A splash of milk" is "a splash", "Salt to taste" is "to taste"). When
 * the food is not in the line, the words before its first " of ". Null when there are none, or too many.
 */
function guessPhraseOf(text: string, foodWord: string | null): string | null {
  const withoutFood =
    foodWord === null || foodWord.trim() === ""
      ? null
      : text.replace(new RegExp(`\\b${escapeForPattern(foodWord.trim())}\\b`, "i"), "");
  const source =
    withoutFood !== null && withoutFood !== text
      ? withoutFood
      : (/^(.+?)\s+of\s/i.exec(text)?.[1] ?? "");
  const phrase = source
    .replace(/\s+/g, " ")
    .replace(/^[\s,;:.-]+|[\s,;:.-]+$/g, "")
    .replace(/\s+of$/i, "")
    .trim()
    .toLowerCase();
  return phrase === "" || phrase.length > GUESS_PHRASE_MAX_CHARACTERS ? null : phrase;
}

function rowOf(line: RecipeImportedLine): AssistantCardRow {
  const base = { name: line.text, amountText: null, time: null, kcalText: null };
  if (line.food === null) {
    return {
      ...base,
      match: "unresolved",
      matchedFood: IMPORT_LINE_NOT_COUNTED,
      estimate: false,
    };
  }
  const guessedAmount =
    line.guess === null
      ? null
      : describeGuessedAmount(line.guess, guessPhraseOf(line.text, line.foodWord));
  return {
    ...base,
    match: "matched",
    matchedFood: describeMatchedImportLine(line.food, guessedAmount),
    estimate: line.guess !== null,
  };
}

/**
 * The card after an `import_recipe_from_url`: the recipe's title, the page it came from, one row for each
 * ingredient line as the page wrote it with the food it matched (or why it is not counted), the numbers of one
 * serving, and a link into the recipe editor. With a line that matched no food the link opens the editor's
 * add-ingredient search for the first such line. Undo archives the recipe.
 */
export function buildRecipeImportedCard({
  recipe,
  sourceUrl,
  lines,
}: RecipeImportedCardInput): AssistantCardDraft {
  const firstUnresolved = lines.find((line) => line.food === null);
  const foodWord = firstUnresolved?.foodWord?.trim() || firstUnresolved?.text;
  return {
    kind: "recipe_created",
    title: describeRecipeCreatedTitle(recipe.name, recipe.servings),
    sub: describeImportedFrom(sourceUrl),
    rows: lines.map(rowOf),
    totalText: describePerServing(recipe.perServing),
    note: null,
    link:
      firstUnresolved === undefined || foodWord === undefined
        ? recipeEditorLink(recipe.id)
        : {
            label: describeChooseFoodFor(foodWord),
            target: {
              screen: "recipe_add_ingredient",
              recipeId: recipe.id,
              query: foodWord.slice(0, EDITOR_SEARCH_MAX_CHARACTERS),
            },
          },
    undo: "available",
    undoneSub: `Removed recipe ${recipe.name}`,
  };
}
