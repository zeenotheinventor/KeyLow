/** The Favourites strip of the log search, between Quick add and Recent. */
export const FAVOURITES_STRIP = {
  heading: "Favourites",
} as const;

/**
 * What a screen reader says on a tile of the strip: "Choose an amount of Porridge", or "Choose an amount of
 * Chicken and rice, recipe". A tile opens the amount step, it does not log.
 */
export const describeFavouriteTileName = (name: string, kind: "food" | "recipe"): string =>
  kind === "recipe" ? `Choose an amount of ${name}, recipe` : `Choose an amount of ${name}`;
