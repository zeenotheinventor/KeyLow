/** What a food is on a shopping list: a store cupboard staple left out by default, or an item to buy. */
export type IngredientKind = "staple" | "item";

/**
 * Which rule decided, so a test or a screen can tell why. `fresh` is a word such as "fresh" or "raw",
 * `dried` a dried herb or spice, `staple_name` a name on the store cupboard list, `food_group` the food's
 * CoFID group, and `default` none of them, which is an item.
 */
export type StapleRule = "fresh" | "dried" | "staple_name" | "food_group" | "default";

export type IngredientClass = { kind: IngredientKind; rule: StapleRule };

/** What the rules read of a food: its name, and its group (a CoFID code, a category tag or null). */
export type ClassifiableFood = { name: string; food_group: string | null };

// A word that says the food is bought fresh wins over every other rule, so fresh thyme is bought while
// dried thyme is not, and a capsicum is never black pepper.
const FRESH_WORDS = new Set(["fresh", "raw", "capsicum", "chillies"]);

// Words that make a herb or spice of CoFID group H the dried, keep-in-the-cupboard kind. They count only
// in group H, because dried apricots, dried pasta and dried lentils are bought like any other food.
const DRIED_WORDS = new Set(["dried", "ground", "powder", "flakes", "seeds"]);

// One word in the first part of the name (before the first comma) makes it a staple, so "Oil, olive" and
// "Olive oil" are and "Tuna, canned in oil" is not. A whole word, so "salted" and "unsalted" are not salt.
const STAPLE_WORDS = new Set([
  "salt",
  "oil",
  "oils",
  "vinegar",
  "stock",
  "bouillon",
  "gravy",
  "sugar",
  "flour",
  "cornflour",
  "yeast",
  "bicarbonate",
  "ketchup",
  "worcestershire",
  "mustard",
  "powder",
  "peppercorns",
  "seasoning",
  "spice",
  "spices",
  "cumin",
  "paprika",
  "turmeric",
  "cinnamon",
  "nutmeg",
  "cardamom",
  "allspice",
  "cayenne",
  "saffron",
  "sumac",
  "fenugreek",
  "asafoetida",
]);

// Two words together in the first part of the name.
const STAPLE_PHRASES: readonly (readonly [string, string])[] = [
  ["soy", "sauce"],
  ["soya", "sauce"],
  ["fish", "sauce"],
  ["black", "pepper"],
  ["white", "pepper"],
  ["garam", "masala"],
  ["baking", "soda"],
  ["vanilla", "extract"],
];

// A staple word that, followed by one of these words, names something else: sugar snap peas are a
// vegetable, and salt beef and salt cod are a meat and a fish.
const NOT_A_STAPLE_AFTER: Readonly<Record<string, ReadonlySet<string>>> = {
  sugar: new Set(["snap"]),
  salt: new Set(["beef", "cod", "pork", "fish"]),
};

// After "pepper" alone as the first part, the words that make it the spice: "Pepper, black" is a staple
// and "Pepper, red" is the vegetable.
const PEPPERCORN_WORDS = new Set(["black", "white", "ground", "cracked", "cayenne"]);

// A word that ends the food itself, so the rest says what it comes in: "Sardines in oil" is a fish.
const ENDS_THE_FOOD = new Set(["in", "with"]);

// The CoFID groups whose foods are store cupboard ones: salt, stock, yeast and the like (WY), oils (OC),
// and sauces and condiments (WC, WCN). Group H, herbs and spices, is a staple unless the name is fresh.
const STAPLE_GROUPS = new Set(["WY", "OC", "WC", "WCN"]);
const HERBS_AND_SPICES = "H";

const wordsOf = (text: string): string[] => text.toLowerCase().match(/\p{L}+/gu) ?? [];

const hasPhrase = (words: readonly string[], [first, second]: readonly [string, string]) =>
  words.some((word, index) => word === first && words[index + 1] === second);

const isStapleWord = (word: string, next: string | undefined): boolean =>
  STAPLE_WORDS.has(word) && (next === undefined || NOT_A_STAPLE_AFTER[word]?.has(next) !== true);

/**
 * Whether the name says it is a store cupboard staple. Read from the first part of the name, the food
 * itself, since the parts after a comma describe it, and only up to "in" or "with". Black pepper is a
 * staple only when "pepper" is the whole first part, as CoFID writes "Pepper, black", and the rest is
 * empty or says which spice, so "Peppers, red" and "Pepper, red" are not.
 */
const namesAStaple = (firstPart: readonly string[], rest: readonly string[]): boolean => {
  const end = firstPart.findIndex((word) => ENDS_THE_FOOD.has(word));
  const food = end === -1 ? firstPart : firstPart.slice(0, end);

  return (
    (food.length === 1 &&
      food[0] === "pepper" &&
      (rest.length === 0 || rest.some((word) => PEPPERCORN_WORDS.has(word)))) ||
    (food.length === 1 && food[0] === "water") ||
    food.some((word, index) => isStapleWord(word, food[index + 1])) ||
    STAPLE_PHRASES.some((phrase) => hasPhrase(food, phrase))
  );
};

/**
 * Sorts a recipe's food for the shopping list: a store cupboard staple (salt, black pepper, soy sauce,
 * oil, stock, dried herbs and spices) that is left out unless the person adds it anyway, or an item to
 * buy (meat, rice, potatoes, vegetables and fresh herbs). The name is read first and the group is a hint,
 * because a user's own food usually has no group. In order:
 *
 * 1. a fresh word ("fresh", "raw", "capsicum", "chillies") anywhere in the name makes it an item.
 * 2. in group H, a dried word ("dried", "ground", "powder", "flakes", "seeds") makes it a staple.
 * 3. a staple name in the first part of the name makes it a staple.
 * 4. group H, WY, OC, WC or WCN makes it a staple.
 * 5. anything else is an item, so a food the rules do not know is never left off the list.
 *
 * It never throws, for any name and any group.
 */
export function classifyIngredient(food: ClassifiableFood): IngredientClass {
  const [firstPart = "", ...rest] = food.name.split(",");
  const firstWords = wordsOf(firstPart);
  const restWords = rest.flatMap(wordsOf);
  const allWords = [...firstWords, ...restWords];
  const group = food.food_group?.trim().toUpperCase() ?? null;

  if (allWords.some((word) => FRESH_WORDS.has(word))) {
    return { kind: "item", rule: "fresh" };
  }
  if (group === HERBS_AND_SPICES && allWords.some((word) => DRIED_WORDS.has(word))) {
    return { kind: "staple", rule: "dried" };
  }
  if (namesAStaple(firstWords, restWords)) {
    return { kind: "staple", rule: "staple_name" };
  }
  if (group !== null && (group === HERBS_AND_SPICES || STAPLE_GROUPS.has(group))) {
    return { kind: "staple", rule: "food_group" };
  }
  return { kind: "item", rule: "default" };
}
