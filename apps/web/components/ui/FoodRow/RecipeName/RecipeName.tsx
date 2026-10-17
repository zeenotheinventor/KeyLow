import type { RecipeNameProps } from "./types";

/**
 * A recipe's name as the library boards draw it: semibold throughout, and when a search matched part of
 * it, only the matched letters semibold and the rest regular.
 */
export function RecipeName({ nameSegments }: RecipeNameProps) {
  const isMatched = nameSegments.some((segment) => segment.matched);

  return nameSegments.map((segment, index) => (
    <span
      // The segments are cut from one name, so their order never changes.
      key={index}
      className={isMatched && !segment.matched ? "font-normal" : "font-semibold"}
    >
      {segment.text}
    </span>
  ));
}
