import { describe, expect, it } from "vitest";

import {
  FAVOURITE_HEART,
  FAVOURITE_TOAST,
  GENERIC_ERROR,
  describeFavouriteChange,
  describeFavouriteFailure,
  describeFavouriteHeart,
} from "../../src/copy";
import { MAX_FAVOURITES } from "../../src/foods";

describe("FAVOURITE_HEART", () => {
  it("should name the heart for what a tap does", () => {
    expect(FAVOURITE_HEART.add).toBe("Add to favourites");
    expect(FAVOURITE_HEART.remove).toBe("Remove from favourites");
  });
});

describe("FAVOURITE_TOAST", () => {
  it("should confirm each change in British English", () => {
    expect(FAVOURITE_TOAST.added).toBe("Added to favourites");
    expect(FAVOURITE_TOAST.removed).toBe("Removed from favourites");
  });

  it("should say the cap when a favourite is refused", () => {
    expect(FAVOURITE_TOAST.limitReached).toContain(String(MAX_FAVOURITES));
    expect(FAVOURITE_TOAST.limitReached).toBe(
      "You can have up to 30 favourites. Remove one to add another.",
    );
  });
});

describe("describeFavouriteHeart", () => {
  const ready = { isFavourite: false, isOnline: true, isRead: true };

  it("should offer to add a food that is not a favourite", () => {
    expect(describeFavouriteHeart(ready)).toEqual({
      label: "Add to favourites",
      isFilled: false,
      isDisabled: false,
    });
  });

  it("should offer to remove a favourite and draw it filled", () => {
    expect(describeFavouriteHeart({ ...ready, isFavourite: true })).toEqual({
      label: "Remove from favourites",
      isFilled: true,
      isDisabled: false,
    });
  });

  it("should be disabled offline, because the change needs a connection", () => {
    expect(describeFavouriteHeart({ ...ready, isOnline: false }).isDisabled).toBe(true);
  });

  it("should be disabled until the favourites have been read, so it never guesses its state", () => {
    expect(describeFavouriteHeart({ ...ready, isRead: false }).isDisabled).toBe(true);
  });
});

describe("describeFavouriteChange", () => {
  it("should confirm an added favourite", () => {
    expect(describeFavouriteChange(true)).toBe("Added to favourites");
  });

  it("should confirm a removed favourite", () => {
    expect(describeFavouriteChange(false)).toBe("Removed from favourites");
  });
});

describe("describeFavouriteFailure", () => {
  it("should say the cap when the limit refused the favourite", () => {
    expect(describeFavouriteFailure(true)).toBe(FAVOURITE_TOAST.limitReached);
  });

  it("should say the generic error for any other failure", () => {
    expect(describeFavouriteFailure(false)).toBe(GENERIC_ERROR);
  });
});
