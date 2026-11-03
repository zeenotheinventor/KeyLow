/** The Favourites strip of the log search, between Quick add and Recent. */
export const FAVOURITES_STRIP = {
  heading: "Favourites",
} as const;

/** What a screen reader says on a tile of the strip: "Log Porridge", or "Log Chicken and rice, recipe". */
export const describeLogFavouriteName = (name: string, kind: "food" | "recipe"): string =>
  kind === "recipe" ? `Log ${name}, recipe` : `Log ${name}`;
