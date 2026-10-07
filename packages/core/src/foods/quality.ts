import type { Food } from "../schemas/food";

/** A suspect food (an OFF product missing macros) must be confirmed by the user before its first log. */
export function requiresConfirmation(food: Pick<Food, "quality">): boolean {
  return food.quality.suspect === true;
}
