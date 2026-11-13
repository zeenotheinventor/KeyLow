import {
  beginRecipePrefill,
  clearRecipePrefill,
  consumeRecipePrefill,
  markRecipePrefillSaved,
  peekRecipePrefill,
  savedRecipeIdOfDraft,
  subscribeRecipePrefill,
} from "../lib/recipePrefill";
import { resetRecipePrefillForTests } from "../lib/recipePrefill/testing";

import type { RecipePrefill } from "../lib/recipePrefill";

// The hand-over from the assistant's recipe card to the recipe editor, and the word back that the recipe was
// saved. A route cannot carry a recipe, and the address must not hold one, so the editor is given an id.

const prefill = (draftKey: string, searchWord: string | null = null): RecipePrefill => ({
  draft: { name: "Chicken and rice", servings: "2", cookedWeight: "", ingredients: [], steps: [] },
  draftKey,
  searchWord,
});
const RECIPE_ID = "55555555-5555-4555-8555-555555555555";

describe("recipe prefill hand-over", () => {
  beforeEach(() => {
    resetRecipePrefillForTests();
  });

  it("should give the editor what the card left, as often as it asks before it takes it", () => {
    const left = prefill("key-a", "harissa paste");
    const id = beginRecipePrefill(left);

    expect(peekRecipePrefill(id)).toBe(left);
    expect(peekRecipePrefill(id)).toBe(left);
  });

  it("should give nothing for an id that was never begun, such as a link someone made up", () => {
    beginRecipePrefill(prefill("key-a"));

    expect(peekRecipePrefill("made-up")).toBeUndefined();
  });

  it("should no longer resolve an id once it is consumed", () => {
    const id = beginRecipePrefill(prefill("key-a"));

    consumeRecipePrefill(id);

    expect(peekRecipePrefill(id)).toBeUndefined();
  });

  it("should leave one draft pending for a card, so a second press replaces the first", () => {
    const first = beginRecipePrefill(prefill("key-a"));
    const second = beginRecipePrefill(prefill("key-a"));

    expect(peekRecipePrefill(first)).toBeUndefined();
    expect(peekRecipePrefill(second)).toBeDefined();
  });

  it("should remember which recipe a draft was saved as, and tell a listener", () => {
    const listener = jest.fn();
    subscribeRecipePrefill(listener);

    expect(savedRecipeIdOfDraft("key-a")).toBeUndefined();
    markRecipePrefillSaved("key-a", RECIPE_ID);

    expect(savedRecipeIdOfDraft("key-a")).toBe(RECIPE_ID);
    expect(savedRecipeIdOfDraft("key-b")).toBeUndefined();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("should stop telling a listener once it has unsubscribed", () => {
    const listener = jest.fn();
    const unsubscribe = subscribeRecipePrefill(listener);
    unsubscribe();

    markRecipePrefillSaved("key-a", RECIPE_ID);

    expect(listener).not.toHaveBeenCalled();
  });

  describe("when the account signs out", () => {
    it("should empty the pending drafts and the saved ones, so the next account sees neither", () => {
      const id = beginRecipePrefill(prefill("key-a"));
      markRecipePrefillSaved("key-b", RECIPE_ID);

      clearRecipePrefill();

      expect(peekRecipePrefill(id)).toBeUndefined();
      expect(savedRecipeIdOfDraft("key-b")).toBeUndefined();
    });

    it("should tell a card that shows a draft as saved, so it goes back to not saved", () => {
      markRecipePrefillSaved("key-b", RECIPE_ID);
      const listener = jest.fn();
      subscribeRecipePrefill(listener);

      clearRecipePrefill();

      expect(listener).toHaveBeenCalledTimes(1);
    });
  });
});
