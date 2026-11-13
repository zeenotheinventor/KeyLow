// How a model's ingredient words become real foods, shared by `import_recipe_from_url` and `suggest_recipe`
// (KEY-838): the food search finds candidates for each line, core cuts them, a tool-less pick call chooses a
// position in each line's list or none, and the chosen food is read with its portions. Nothing here decides a
// food by order or by score, and nothing logs a word.
import { importFoodCandidates, importSearchWords } from "../../core.ts";
import { getFood, listFoodPortions, searchFoods } from "../../repos.ts";

import type { ToolContext } from "../tool.ts";

// The most searches at once, so a long ingredient list does not open forty requests together.
export const SEARCHES_AT_ONCE = 8;
// Hits asked of the search for one word. The line's candidates are cut from them in core.
const HITS_PER_SEARCH = 50;
export const SEARCH_TEXT_MAX_CHARACTERS = 80;

export type FoodHit = Awaited<ReturnType<typeof searchFoods>>[number];

// Runs `work` for every item, at most `limit` at once, and keeps the order.
export async function inBatches<Item, Result>(
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

// The foods to offer for each food word: the hits of every search word of it, joined and cut in core. A word of
// fewer than two characters has none. At most `SEARCHES_AT_ONCE` searches run together, across all the words.
export async function candidatesOfWords(
  ctx: ToolContext,
  foodWords: readonly (string | null)[],
): Promise<FoodHit[][]> {
  const cut = foodWords.map((word) => (word?.trim() ?? "").slice(0, SEARCH_TEXT_MAX_CHARACTERS));
  const searches = cut.flatMap((word, wordIndex) =>
    (word.length < 2 ? [] : importSearchWords(word)).map((searchWord) => ({
      wordIndex,
      searchWord,
    })),
  );
  const hits = await inBatches(searches, SEARCHES_AT_ONCE, ({ searchWord }) =>
    searchFoods(ctx.caller, searchWord, HITS_PER_SEARCH),
  );
  return cut.map((word, wordIndex) =>
    importFoodCandidates(
      word,
      searches.flatMap(({ wordIndex: searched }, searchIndex) =>
        searched === wordIndex ? [hits[searchIndex] ?? []] : [],
      ),
    ),
  );
}

export type FoodAndPortions = {
  food: NonNullable<Awaited<ReturnType<typeof getFood>>>;
  portions: Awaited<ReturnType<typeof listFoodPortions>>;
};

// A food and its portions, or null when it is gone or deleted. Each id is read once, however many lines use it.
export async function readFoodAndPortions(
  ctx: ToolContext,
  foodId: string,
  cache: Map<string, Promise<FoodAndPortions | null>>,
): Promise<FoodAndPortions | null> {
  let read = cache.get(foodId);
  if (read === undefined) {
    read = Promise.all([getFood(ctx.caller, foodId), listFoodPortions(ctx.caller, foodId)]).then(
      ([food, portions]) => (food === null || food.deleted_at !== null ? null : { food, portions }),
    );
    cache.set(foodId, read);
  }
  return await read;
}
