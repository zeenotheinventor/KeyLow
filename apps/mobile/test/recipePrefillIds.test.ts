import { beginRecipePrefill } from "../lib/recipePrefill";

// The id the address carries is from the phone's secure random source, not a count, so another link cannot guess it.
// This file does not reset the store, so it is the app's own, with its own id source.

const prefill = {
  draft: { name: "x", servings: "1", cookedWeight: "", ingredients: [], steps: [] },
  draftKey: "k",
  searchWord: null,
};

describe("the id a drafted recipe is left under", () => {
  it("should be 48 hex characters, and different each time", () => {
    const first = beginRecipePrefill({ ...prefill, draftKey: "a" });
    const second = beginRecipePrefill({ ...prefill, draftKey: "b" });

    expect(first).toMatch(/^[0-9a-f]{48}$/);
    expect(second).toMatch(/^[0-9a-f]{48}$/);
    expect(first).not.toBe(second);
  });
});
