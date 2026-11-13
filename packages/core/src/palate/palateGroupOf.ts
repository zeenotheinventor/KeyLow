import { stemOf, wordsOf } from "../foods/strongFoodMatch";

import type { PalateGroup } from "./palateGroups";
import type { FoodSource } from "../schemas/food";

// CoFID's group codes (AM and AP hold the biscuits, bagels, English muffins, crispbread and oatcakes that go
// with the bread), matched by their longest listed prefix, so "BAB" is found by "BA" and "DAM" by "DA".
// A code with no listed prefix falls to the name. The codes are the ones in the CoFID 2021 file.
const COFID_GROUP_BY_PREFIX: Readonly<Record<string, PalateGroup>> = {
  A: "grains and bread",
  AN: "sweets and snacks",
  AO: "sweets and snacks",
  AS: "sweets and snacks",
  BA: "dairy",
  BC: "dairy",
  BH: "dairy",
  BJ: "dairy",
  BL: "dairy",
  BN: "dairy",
  BP: "sweets and snacks",
  BR: "sweets and snacks",
  BTM: "fats and oils",
  BV: "dairy",
  C: "eggs",
  CDH: "sweets and snacks",
  D: "vegetables",
  DA: "potatoes",
  DB: "legumes and nuts",
  DF: "legumes and nuts",
  F: "fruit",
  G: "legumes and nuts",
  H: "other",
  J: "fish",
  M: "meat",
  O: "fats and oils",
  P: "drinks",
  Q: "drinks",
  S: "sweets and snacks",
  W: "other",
};

const LONGEST_COFID_PREFIX = 3;

function groupOfCofidCode(foodGroup: string | null): PalateGroup | null {
  const code = /^[A-Z]+/.exec((foodGroup ?? "").trim().toUpperCase())?.[0] ?? "";
  for (let length = Math.min(code.length, LONGEST_COFID_PREFIX); length >= 1; length -= 1) {
    const group = COFID_GROUP_BY_PREFIX[code.slice(0, length)];
    if (group !== undefined) {
      return group;
    }
  }
  return null;
}

// Open Food Facts category tags without their language prefix, which is what `foods.food_group` holds.
// Only the first tag is stored and it is often broad, so a broad one is left out and read by name.
const OFF_GROUP_BY_CATEGORY: ReadonlyMap<string, PalateGroup> = new Map<string, PalateGroup>(
  Object.entries({
    breads: "grains and bread",
    "breakfast-cereals": "grains and bread",
    cereals: "grains and bread",
    "cereals-and-potatoes": "grains and bread",
    "cereals-and-their-products": "grains and bread",
    noodles: "grains and bread",
    pastas: "grains and bread",
    rices: "grains and bread",
    potatoes: "potatoes",
    chicken: "meat",
    "meat-based-products": "meat",
    meats: "meat",
    poultries: "meat",
    sausages: "meat",
    fishes: "fish",
    "fishes-and-seafood": "fish",
    "fish-and-seafood": "fish",
    seafood: "fish",
    eggs: "eggs",
    cheeses: "dairy",
    creams: "dairy",
    dairies: "dairy",
    "fermented-milk-products": "dairy",
    milks: "dairy",
    yogurts: "dairy",
    fruits: "fruit",
    vegetables: "vegetables",
    legumes: "legumes and nuts",
    "legumes-and-their-products": "legumes and nuts",
    nuts: "legumes and nuts",
    "nuts-and-their-products": "legumes and nuts",
    "peanut-butters": "legumes and nuts",
    seeds: "legumes and nuts",
    butters: "fats and oils",
    fats: "fats and oils",
    margarines: "fats and oils",
    oils: "fats and oils",
    "oils-and-fats": "fats and oils",
    "olive-oils": "fats and oils",
    "vegetable-oils": "fats and oils",
    "biscuits-and-cakes": "sweets and snacks",
    candies: "sweets and snacks",
    chocolates: "sweets and snacks",
    confectioneries: "sweets and snacks",
    desserts: "sweets and snacks",
    "ice-creams-and-sorbets": "sweets and snacks",
    "salty-snacks": "sweets and snacks",
    snacks: "sweets and snacks",
    "sweet-snacks": "sweets and snacks",
    "alcoholic-beverages": "drinks",
    beers: "drinks",
    beverages: "drinks",
    "carbonated-drinks": "drinks",
    coffees: "drinks",
    juices: "drinks",
    "fruit-juices": "drinks",
    sodas: "drinks",
    teas: "drinks",
    waters: "drinks",
    wines: "drinks",
    condiments: "other",
    sauces: "other",
    soups: "other",
    spices: "other",
  }),
);

// The words that put a food in a group when its code or category cannot, in the order they are tried.
// Drinks come before fruit, so a juice is not fruit. Nuts come before fats, so peanut butter is not a fat.
// "Sweet" is not a word here, so sweet potato stays with the potatoes.
const NAME_WORDS_BY_GROUP: ReadonlyArray<readonly [PalateGroup, readonly string[]]> = [
  [
    "legumes and nuts",
    [
      "almond",
      "cashew",
      "chickpea",
      "edamame",
      "hazelnut",
      "hummus",
      "lentil",
      "nut",
      "peanut",
      "pecan",
      "pistachio",
      "tofu",
      "walnut",
    ],
  ],
  ["drinks", ["beer", "cider", "coffee", "cola", "juice", "lemonade", "smoothie", "tea", "wine"]],
  [
    "sweets and snacks",
    [
      "biscuit",
      "brownie",
      "cake",
      "candy",
      "chocolate",
      "cookie",
      "crisp",
      "doughnut",
      "fudge",
      "marshmallow",
      "toffee",
    ],
  ],
  ["fats and oils", ["butter", "ghee", "lard", "margarine", "oil"]],
  [
    "meat",
    [
      "bacon",
      "beef",
      "burger",
      "chicken",
      "duck",
      "gammon",
      "ham",
      "lamb",
      "mince",
      "pork",
      "sausage",
      "steak",
      "turkey",
      "venison",
    ],
  ],
  [
    "fish",
    [
      "cod",
      "fish",
      "haddock",
      "mackerel",
      "plaice",
      "prawn",
      "salmon",
      "sardine",
      "seafood",
      "shrimp",
      "trout",
      "tuna",
    ],
  ],
  ["eggs", ["egg", "omelette"]],
  ["dairy", ["cheese", "cream", "kefir", "milk", "skyr", "yoghurt", "yogurt"]],
  ["potatoes", ["chip", "fries", "potato", "wedge"]],
  [
    "grains and bread",
    [
      "bagel",
      "bread",
      "cereal",
      "couscous",
      "flour",
      "granola",
      "muesli",
      "noodle",
      "oat",
      "pasta",
      "porridge",
      "quinoa",
      "rice",
      "toast",
      "wrap",
    ],
  ],
  [
    "fruit",
    [
      "apple",
      "apricot",
      "banana",
      "berry",
      "blueberry",
      "cherry",
      "fruit",
      "grape",
      "kiwi",
      "lemon",
      "mango",
      "melon",
      "orange",
      "peach",
      "pear",
      "pineapple",
      "plum",
      "raspberry",
      "strawberry",
    ],
  ],
  [
    "vegetables",
    [
      "asparagus",
      "aubergine",
      "broccoli",
      "cabbage",
      "carrot",
      "cauliflower",
      "celery",
      "courgette",
      "cucumber",
      "kale",
      "leek",
      "lettuce",
      "mushroom",
      "onion",
      "pepper",
      "salad",
      "spinach",
      "sweetcorn",
      "tomato",
      "vegetable",
    ],
  ],
];

const NAME_STEMS_BY_GROUP: ReadonlyArray<readonly [PalateGroup, ReadonlySet<string>]> =
  NAME_WORDS_BY_GROUP.map(([group, words]) => [group, new Set(words.map(stemOf))] as const);

// The first part of the name (before the first comma) says what the food is, so "Eggs, chicken, whole,
// boiled" is eggs and not chicken. Within a part, the group tried first on the list wins.
function groupOfName(name: string): PalateGroup | null {
  for (const part of name.split(",")) {
    const stems = wordsOf(part).map(stemOf);
    const group = NAME_STEMS_BY_GROUP.find(([, wordStems]) =>
      stems.some((stem) => wordStems.has(stem)),
    )?.[0];
    if (group !== undefined) {
      return group;
    }
  }
  return null;
}

const NON_DAIRY = /\b(non[- ]?dairy|dairy[- ]free)\b/i;

const MILK_ALTERNATIVE_WORDS = new Set([
  "almond",
  "cashew",
  "coconut",
  "hazelnut",
  "oat",
  "rice",
  "soy",
  "soya",
]);

// A milk alternative is a drink and not dairy: "Soya milk", "Oat drink", "Milk, almond", or any milk
// marked non-dairy. A dish made with one ("Porridge made with oat milk") is not, because the name must be
// at most three words ending in milk or drink.
function isMilkAlternative(name: string): boolean {
  const [firstWords = [], secondWords = []] = name.split(",").map((part) => wordsOf(part));
  const lastWord = firstWords.at(-1);
  const isMilkName = (lastWord === "milk" || lastWord === "drink") && firstWords.length <= 3;
  return (
    (isMilkName && firstWords.some((word) => MILK_ALTERNATIVE_WORDS.has(word))) ||
    (firstWords.length === 1 &&
      firstWords[0] === "milk" &&
      secondWords.some((word) => MILK_ALTERNATIVE_WORDS.has(word))) ||
    (NON_DAIRY.test(name) && firstWords.includes("milk"))
  );
}

/**
 * The coarse group of a food, for the palate and for nothing else (ADR 0003, Amendment 22). The group
 * column holds raw source vocabulary: a CoFID code such as `AD`, or an Open Food Facts category tag. A
 * code or category the tables do not know, a missing group and a food the person made all fall to the
 * name, and a name it cannot place is "other". The answer is never stored.
 */
export function palateGroupOf(
  source: FoodSource,
  foodGroup: string | null,
  name: string,
): PalateGroup {
  const nonDairyCreamerCode =
    source === "cofid" && /^\s*BC/i.test(foodGroup ?? "") && NON_DAIRY.test(name);
  if (nonDairyCreamerCode || isMilkAlternative(name)) {
    return "drinks";
  }
  const fromGroup =
    source === "cofid"
      ? groupOfCofidCode(foodGroup)
      : source === "off"
        ? (OFF_GROUP_BY_CATEGORY.get((foodGroup ?? "").trim().toLowerCase()) ?? null)
        : null;
  return fromGroup ?? groupOfName(name) ?? "other";
}
