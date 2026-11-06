import type { KeyboardEventHandler } from "react";

export type FavouriteTileProps = {
  /** Whether the favourite is a food (the Utensils icon) or a recipe (the ChefHat icon). */
  kind: "food" | "recipe";
  name: string;
  /** Opens the amount step for the favourite. */
  onPress: () => void;
  /** Lets the strip move the focus between tiles with the arrow keys. */
  onKeyDown?: KeyboardEventHandler<HTMLButtonElement>;
};
