import type { RecipeViewIngredientRowProps } from "./types";

/**
 * One ingredient of the recipe view: the food's name and the amount, nothing else. It is not pressable,
 * has no icon and no nutrition line, and a screen reader reads it as one thing, named by core.
 */
export function RecipeViewIngredientRow({
  name,
  caption,
  accessibleName,
}: RecipeViewIngredientRowProps) {
  return (
    <li
      aria-label={accessibleName}
      className="box-border flex min-h-[60px] flex-col justify-center gap-1 border-t border-border px-4 py-2"
    >
      <span className="line-clamp-2 text-body-strong">{name}</span>
      <span className="text-caption tabular-nums text-text-muted">{caption}</span>
    </li>
  );
}
