import { describePortionNoun } from "../copy/portionPicker";

import type { PlateItem } from "./types";

export type PlateUnitWords = { singular: string; plural: string };

// A size reads as the portion's name ("1 medium") and a spoon is written the way the picker writes it ("2 tbsp"):
// neither takes an s.
const UNCHANGED_WORDS = ["small", "medium", "large", "extra small", "extra large", "tsp", "tbsp"];

// Nouns whose plural is no s, es or ies. The last word of the noun is looked up here.
const IRREGULAR_PLURALS: Readonly<Record<string, string>> = {
  tomato: "tomatoes",
  potato: "potatoes",
  leaf: "leaves",
  loaf: "loaves",
  half: "halves",
};

function pluralOfWord(word: string): string {
  const irregular = IRREGULAR_PLURALS[word];
  if (irregular !== undefined) {
    return irregular;
  }
  if (/[^aeiou]y$/.test(word)) {
    return `${word.slice(0, -1)}ies`;
  }
  return /(s|x|z|ch|sh)$/.test(word) ? `${word}es` : `${word}s`;
}

// The head of the noun takes the plural: "slice of bread" is "slices of bread", "apricot half" is "apricot halves".
function pluralOf(noun: string): string {
  if (UNCHANGED_WORDS.includes(noun)) {
    return noun;
  }
  const [head = noun, ...rest] = noun.split(" of ");
  const lastSpace = head.lastIndexOf(" ");
  const plural = `${head.slice(0, lastSpace + 1)}${pluralOfWord(head.slice(lastSpace + 1))}`;

  return [plural, ...rest].join(" of ");
}

/**
 * The word after a row's amount in its two forms: "serving" and "servings", "pot" and "pots", "medium", "g",
 * "ml". A portion gives the noun its name does (`describePortionNoun`), else "portion" and "portions".
 */
export function plateUnitWords(item: PlateItem): PlateUnitWords {
  if (item.kind === "recipe") {
    return item.unit === "g"
      ? { singular: "g", plural: "g" }
      : { singular: "serving", plural: "servings" };
  }
  if (item.unit.kind !== "portion") {
    return { singular: item.unit.kind, plural: item.unit.kind };
  }
  const noun = describePortionNoun(item.unit.label);

  // A number in the noun ("box of 6") cannot take a plural, so it is a count of portions.
  return noun === undefined || /\d/.test(noun)
    ? { singular: "portion", plural: "portions" }
    : { singular: noun, plural: pluralOf(noun) };
}

/** The word a row writes after its amount: the singular for exactly 1, else the plural. */
export function plateUnitWord(item: PlateItem): string {
  const words = plateUnitWords(item);

  return item.quantity === 1 ? words.singular : words.plural;
}
