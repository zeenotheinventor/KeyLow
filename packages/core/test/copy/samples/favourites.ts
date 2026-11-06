import * as copy from "../../../src/copy";

// Every function `src/copy/favourites.ts` exports, called with representative arguments. The voice test fails
// when a function has no row, so no sentence escapes the sweep.
export const samples: Record<string, () => string[]> = {
  describeFavouriteHeart: () => [
    copy.describeFavouriteHeart({ isFavourite: false, isOnline: true, isRead: true }).label,
    copy.describeFavouriteHeart({ isFavourite: true, isOnline: true, isRead: true }).label,
  ],
  describeFavouriteChange: () => [
    copy.describeFavouriteChange(true),
    copy.describeFavouriteChange(false),
  ],
  describeFavouriteFailure: () => [
    copy.describeFavouriteFailure(true),
    copy.describeFavouriteFailure(false),
  ],
};
