import { describe, expect, it } from "vitest";

import { FAVOURITES_STRIP, describeLogFavouriteName } from "../../src/copy";

describe("the Favourites strip's copy", () => {
  it("should head the strip Favourites", () => {
    expect(FAVOURITES_STRIP.heading).toBe("Favourites");
  });

  it("should name a tile for a screen reader by what pressing it does", () => {
    expect(describeLogFavouriteName("Porridge")).toBe("Log Porridge");
  });
});
