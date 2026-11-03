/** The Favourites strip of the log search, between Quick add and Recent. */
export const FAVOURITES_STRIP = {
  heading: "Favourites",
} as const;

/** What a screen reader says on a tile of the strip, whether the favourite is a food or a recipe. */
export const describeLogFavouriteName = (name: string): string => `Log ${name}`;
