import { stemOf, wordsOf } from "../foods/strongFoodMatch";

import type { PalatePreference } from "./types";

export type FoodAvoidance =
  { avoid: false; reason: null } | { avoid: true; reason: "allergy" | "dislike" };

const MIN_STEM_LENGTH_INSIDE_A_WORD = 3;

// Accents are folded away and "soya" is read as "soy", so "Jalapeño" is "jalapeno" and soy is soya.
const wordsOfText = (text: string): string[] =>
  wordsOf(text.normalize("NFD").replace(/\p{M}/gu, "")).map((word) =>
    word === "soya" ? "soy" : word,
  );

/**
 * Whether the person has said to leave a food out, by its id and then by its name. The label's words,
 * compared by stem and with accents folded and soy and soya as one word, all have to be whole words of
 * the name, so "peanuts" finds "Peanut butter" and "nut" does not find a dislike of "Peanuts". For an
 * allergy only, a label stem of 3 or more letters is also found inside a word of the name, so "nut" finds
 * walnut, hazelnut and peanut and "peanut" finds "Peanutbutter": hiding too much is the safe direction
 * for an allergy. The name is all there is to read. Neither CoFID nor the seed carries allergen data, so
 * a food can hold an allergen without saying so, and the copy says that. An allergy wins over a dislike.
 * A correction and a blank label match nothing.
 */
export function avoidsFood(
  food: { id?: string | null; name: string },
  preferences: readonly PalatePreference[],
): FoodAvoidance {
  const nameWords = wordsOfText(food.name);
  const nameStems = new Set(nameWords.map(stemOf));
  const matches = (kind: "allergy" | "dislike"): boolean =>
    preferences.some((preference) => {
      if (preference.kind !== kind) {
        return false;
      }
      if (food.id !== undefined && food.id !== null && preference.foodId === food.id) {
        return true;
      }
      const labelStems = wordsOfText(preference.label ?? "").map(stemOf);
      return (
        labelStems.length > 0 &&
        labelStems.every(
          (stem) =>
            nameStems.has(stem) ||
            (kind === "allergy" &&
              stem.length >= MIN_STEM_LENGTH_INSIDE_A_WORD &&
              nameWords.some((word) => word.includes(stem))),
        )
      );
    });
  if (matches("allergy")) {
    return { avoid: true, reason: "allergy" };
  }
  return matches("dislike") ? { avoid: true, reason: "dislike" } : { avoid: false, reason: null };
}
