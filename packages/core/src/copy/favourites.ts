import { MAX_FAVOURITES } from "../foods/favourites";

/** The names of the heart on a food's and a recipe's header: what a tap does, not the state it is in. */
export const FAVOURITE_HEART = {
  add: "Add to favourites",
  remove: "Remove from favourites",
};

/** The toasts after a tap on the heart. A failed write shows the generic error sentence instead. */
export const FAVOURITE_TOAST = {
  added: "Added to favourites",
  removed: "Removed from favourites",
  limitReached: `You can have up to ${MAX_FAVOURITES} favourites. Remove one to add another.`,
};
