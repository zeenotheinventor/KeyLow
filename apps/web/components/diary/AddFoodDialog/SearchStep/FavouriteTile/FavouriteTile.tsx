import { describeFavouriteTileName } from "@keylow/core/copy";
import { ChefHat, Utensils } from "lucide-react";

import type { FavouriteTileProps } from "./types";

/**
 * One favourite of the idle search's strip, as the web idle board draws it: a 52 pixel circle with the food
 * icon (Utensils) or the recipe icon (ChefHat), and the name under it on one line, cut with an ellipsis when
 * it is long. A food opens the portion step and a recipe the recipe amount step. The tile is 72 pixels wide
 * and 72 high, so the whole of it is the touch target, and its focus ring is drawn inside it because
 * the strip scrolls and would clip a ring drawn outside.
 */
export function FavouriteTile({ kind, name, onPress, onKeyDown }: FavouriteTileProps) {
  const Icon = kind === "recipe" ? ChefHat : Utensils;

  return (
    <button
      type="button"
      aria-label={describeFavouriteTileName(name, kind)}
      onClick={onPress}
      onKeyDown={onKeyDown}
      className="flex w-[72px] shrink-0 cursor-pointer flex-col items-center gap-1 rounded-medium outline-none transition-colors duration-quick hover:bg-hover-overlay active:bg-press-overlay focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus-ring"
    >
      <span className="flex size-[52px] items-center justify-center rounded-full border border-border bg-surface-raised text-text-secondary">
        <Icon aria-hidden className="size-6" strokeWidth={1.75} />
      </span>
      <span className="w-full truncate text-center text-caption text-text-secondary">{name}</span>
    </button>
  );
}
