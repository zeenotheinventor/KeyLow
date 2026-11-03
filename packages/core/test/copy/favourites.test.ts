import { describe, expect, it } from "vitest";

import { FAVOURITE_HEART, FAVOURITE_TOAST } from "../../src/copy";
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
