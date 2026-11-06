import { GENERIC_ERROR } from "./errors";
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

type FavouriteHeartInput = {
  isFavourite: boolean;
  isOnline: boolean;
  /** Whether the favourites have been read, so the heart never guesses the state it is in. */
  isRead: boolean;
};

/**
 * What the heart of a food's or a recipe's header says and does, for both apps: its name is what a tap does,
 * it is drawn filled for a favourite, and it is disabled offline and until the favourites have been read,
 * because the change needs a connection.
 */
export function describeFavouriteHeart({ isFavourite, isOnline, isRead }: FavouriteHeartInput) {
  return {
    label: isFavourite ? FAVOURITE_HEART.remove : FAVOURITE_HEART.add,
    isFilled: isFavourite,
    isDisabled: !isOnline || !isRead,
  };
}

/** The toast after a tap on the heart, for the state it has just changed to. */
export function describeFavouriteChange(isFavourite: boolean): string {
  return isFavourite ? FAVOURITE_TOAST.added : FAVOURITE_TOAST.removed;
}

/** The one fixed sentence of a write that failed: the cap when the limit refused it, the generic error otherwise. */
export function describeFavouriteFailure(isLimitReached: boolean): string {
  return isLimitReached ? FAVOURITE_TOAST.limitReached : GENERIC_ERROR;
}
