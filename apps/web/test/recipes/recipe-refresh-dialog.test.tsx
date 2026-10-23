import {
  DIARY_LOAD_FAILED,
  RECIPE_NOT_FOUND,
  REFRESH,
  RETRY_LABEL,
  SAVE_FAILED_BANNER,
} from "@keylow/core/copy";
import { buildRecipeIngredient } from "@keylow/core/recipes";
import { buildFood, buildFoodPortion } from "@keylow/core/testing";
import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  REFRESH_RECIPE_ID,
  chickenAndRice,
  foodsAfterTheChickenEdit,
  foodsAsSaved,
  foodsWithTheOilDeleted,
  oilDeletedOnly,
  refreshBackend,
  releaseSaves,
  renderWithRefresh,
  resetRefreshBackend,
} from "./refreshSupport";

import type { RefreshRecipe } from "./refreshSupport";
import type { Food } from "@keylow/core/schemas";

import { RecipeRefreshDialog } from "@/components/recipes/RecipeRefreshDialog";

const onClose = vi.fn<() => void>();

beforeEach(() => {
  resetRefreshBackend();
  onClose.mockReset();
});

afterEach(() => {
  cleanup();
  onlineManager.setOnline(true);
});

function seed(foods: Food[] = foodsAfterTheChickenEdit, recipe: RefreshRecipe = chickenAndRice) {
  refreshBackend.recipe = recipe;
  refreshBackend.foods = foods;
}

const dialogOptions = { id: REFRESH_RECIPE_ID };

function showDialog(id = dialogOptions.id) {
  return renderWithRefresh(<RecipeRefreshDialog open recipeId={id} onClose={onClose} />);
}

const applyButton = () => screen.findByRole("button", { name: REFRESH.apply });
// The count is written after the heading in its own span, which a screen reader reads on from the words.
const headingTextStartingWith = (start: string) =>
  screen.getByRole("heading", { name: new RegExp(`^${start}`) }).textContent;
const group = (name: string) => screen.getByRole("group", { name });

// A press starts its write after an await, so what a press did not do is only known once that has had its turn.
const letWorkSettle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });

// A real press puts focus on the button first, which fireEvent.click does not.
function pressTryAgain() {
  const tryAgain = screen.getByRole("button", { name: RETRY_LABEL });
  tryAgain.focus();
  fireEvent.click(tryAgain);
}

async function showDiff() {
  seed();
  showDialog();
  await screen.findByRole("region", { name: REFRESH.perServingRegionName });
}

describe("RecipeRefreshDialog", () => {
  describe("the diff", () => {
    it("should be a dialog named Refresh ingredients, with the intro first", async () => {
      await showDiff();

      const dialog = screen.getByRole("dialog", { name: "Refresh ingredients" });
      expect(within(dialog).getByText(REFRESH.intro)).toBeTruthy();
      expect(within(dialog).getByRole("button", { name: "Close" })).toBeTruthy();
    });

    it("should show the Per serving card before and after, read in words", async () => {
      await showDiff();

      const card = within(screen.getByRole("region", { name: "Per serving, before and after" }));
      expect(card.getByRole("heading", { name: "Per serving" })).toBeTruthy();
      expect(card.getByRole("group", { name: "Calories, 374 before, 362 now" })).toBeTruthy();
      expect(card.getByRole("group", { name: "Protein, 32 before, 35 now" })).toBeTruthy();
      expect(card.getByRole("group", { name: "Carbs, 43 grams, no change" })).toBeTruthy();
      expect(card.getByRole("group", { name: "Fat, 8.1 before, 6.8 now" })).toBeTruthy();
    });

    it("should write the new value with its unit once, and an unchanged one with no change after it", async () => {
      await showDiff();

      const calories = within(group("Calories, 374 before, 362 now"));
      expect(calories.getByText("374")).toBeTruthy();
      expect(calories.getByText("362 kcal")).toBeTruthy();
      const carbs = within(group("Carbs, 43 grams, no change"));
      expect(carbs.getByText("43 g")).toBeTruthy();
      expect(carbs.getByText("no change")).toBeTruthy();
    });

    it("should show the changed ingredient with its source, its amount and the figures that differ", async () => {
      await showDiff();

      expect(headingTextStartingWith("Changed")).toBe("Changed · 1");
      const card = within(screen.getByRole("group", { name: "Chicken breast fillets" }));
      expect(await card.findByText("Yours")).toBeTruthy();
      expect(card.getByText("500 g")).toBeTruthy();
      expect(card.getByRole("group", { name: "Calories, 600 before, 550 now" })).toBeTruthy();
      expect(card.getByText("Per 100 g")).toBeTruthy();
      expect(card.getByRole("group", { name: "Energy, 120 before, 110 now" })).toBeTruthy();
      expect(card.getByRole("group", { name: "Protein, 23 before, 25 now" })).toBeTruthy();
      expect(card.getByRole("group", { name: "Fat, 2.1 before, 1 now" })).toBeTruthy();
      // Carbs were 0 and are 0, so they are not listed.
      expect(card.queryByRole("group", { name: /^Carbohydrate/ })).toBeNull();
    });

    it("should still show the changed ingredient, without a source, when its food cannot be read for it", async () => {
      seed();
      // The three reads of the check come first, and the card's own read is the fourth.
      refreshBackend.failsFoodReadsAfter = 3;
      showDialog();

      const card = within(await screen.findByRole("group", { name: "Chicken breast fillets" }));
      expect(card.getByRole("group", { name: "Calories, 600 before, 550 now" })).toBeTruthy();
      expect(card.getByText("500 g")).toBeTruthy();
      await waitFor(() => {
        expect(refreshBackend.foodReads).toBeGreaterThanOrEqual(4);
      });
      await letWorkSettle();
      expect(card.queryByText("Yours")).toBeNull();
      expect(await applyButton()).toBeTruthy();
    });

    it("should list the ingredients that did not change, with their amounts and no values", async () => {
      await showDiff();

      expect(headingTextStartingWith("Unchanged")).toBe("Unchanged · 2");
      const list = within(
        within(screen.getByRole("region", { name: "Unchanged" })).getByRole("list"),
      );
      const rows = list.getAllByRole("listitem");
      expect(rows.map((row) => row.textContent)).toEqual(["Long grain rice200 g", "Olive oil20 g"]);
      expect(list.queryByRole("button")).toBeNull();
    });

    it("should offer Apply, which says what it replaces, and Cancel", async () => {
      await showDiff();

      const apply = await applyButton();
      expect(apply.getAttribute("aria-description")).toBe(REFRESH.applyHint);
      expect(screen.getByRole("button", { name: "Cancel" })).toBeTruthy();
    });

    it("should add the line for a portion that is no longer on the food", async () => {
      const mediumOnion = buildFoodPortion({
        id: "00000000-0000-4000-8000-0000000000b2",
        label: "1 medium",
        grams: 110,
      });
      const onionAsSaved = buildFood({
        id: "00000000-0000-4000-8000-0000000000c4",
        name: "Onions, raw",
        kcal: 35,
      });
      seed([{ ...onionAsSaved, kcal: 40 }], {
        ...chickenAndRice,
        ingredients: [
          buildRecipeIngredient(onionAsSaved, {
            quantity: 1,
            unit: "portion",
            portion: mediumOnion,
          }),
        ],
      });
      // The food's portions no longer list the medium.
      refreshBackend.portions = [];
      showDialog();

      expect(
        await screen.findByText("1 medium is no longer on this food, so the amount becomes 110 g."),
      ).toBeTruthy();
    });
  });

  describe("focus", () => {
    it("should start on the intro, so the change is read before the buttons", async () => {
      await showDiff();

      await waitFor(() => {
        expect(document.activeElement).toBe(screen.getByText(REFRESH.intro));
      });
    });

    it("should stay inside the dialog, from the last button back to the first", async () => {
      await showDiff();
      const apply = await applyButton();
      apply.focus();

      fireEvent.keyDown(document, { key: "Tab" });

      expect(document.activeElement).toBe(screen.getByRole("button", { name: "Close" }));
    });
  });

  describe("Apply", () => {
    it("should save the refreshed ingredients once, close, and say so", async () => {
      await showDiff();

      fireEvent.click(await applyButton());

      await waitFor(() => {
        expect(onClose).toHaveBeenCalledTimes(1);
      });
      expect(refreshBackend.saves).toHaveLength(1);
      expect(await screen.findByText("Ingredients refreshed")).toBeTruthy();
      // The toast takes no action: the diff was the check.
      expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
    });

    it("should write the chicken as the food is now", async () => {
      await showDiff();

      fireEvent.click(await applyButton());

      await waitFor(() => {
        expect(refreshBackend.saves).toHaveLength(1);
      });
      const [saved] = refreshBackend.saves;
      expect(saved?.["p_recipe_id"]).toBe(REFRESH_RECIPE_ID);
      expect(JSON.stringify(saved?.["p_ingredients"])).toContain('"kcal":110');
    });

    it("should show the loading state on Apply while it saves, with Cancel unable to leave", async () => {
      await showDiff();
      refreshBackend.isHoldingSaves = true;
      const apply = await applyButton();

      fireEvent.click(apply);

      await waitFor(() => {
        expect(apply.getAttribute("aria-busy")).toBe("true");
      });
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
      fireEvent.click(screen.getByRole("button", { name: "Close" }));
      fireEvent.keyDown(document, { key: "Escape" });
      await letWorkSettle();
      expect(onClose).not.toHaveBeenCalled();
      releaseSaves();
      await waitFor(() => {
        expect(onClose).toHaveBeenCalledTimes(1);
      });
    });

    it("should save once when Apply is pressed twice", async () => {
      await showDiff();
      refreshBackend.isHoldingSaves = true;
      const apply = await applyButton();

      fireEvent.click(apply);
      fireEvent.click(apply);
      await letWorkSettle();
      releaseSaves();

      await waitFor(() => {
        expect(onClose).toHaveBeenCalledTimes(1);
      });
      await letWorkSettle();
      expect(refreshBackend.saves).toHaveLength(1);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("should close even when the refetch after the save finds nothing left to refresh", async () => {
      await showDiff();
      const readsBefore = refreshBackend.recipeReads;

      fireEvent.click(await applyButton());

      await waitFor(() => {
        expect(onClose).toHaveBeenCalledTimes(1);
      });
      // The save refreshes the preview, which then reads nothing to refresh. The dialog has gone by then, and
      // until it does it still shows the diff that Apply was pressed on.
      await waitFor(() => {
        expect(refreshBackend.recipeReads).toBeGreaterThan(readsBefore + 1);
      });
      await letWorkSettle();
      expect(screen.queryByText(REFRESH.nothingTitle)).toBeNull();
      expect(screen.getByRole("group", { name: "Calories, 374 before, 362 now" })).toBeTruthy();
    });

    it("should stay open with the fixed sentence under the header, and ready to press again, when the save fails", async () => {
      await showDiff();
      refreshBackend.failsSaves = true;
      const apply = await applyButton();

      fireEvent.click(apply);

      const banner = await screen.findByRole("alert");
      expect(banner.textContent).toContain(SAVE_FAILED_BANNER);
      expect(screen.queryByText(/raw database text/)).toBeNull();
      expect(onClose).not.toHaveBeenCalled();
      expect(screen.queryByText("Ingredients refreshed")).toBeNull();
      await waitFor(() => {
        expect(apply.getAttribute("aria-busy")).toBeNull();
      });
      // The diff is still the one the person saw, and Apply works again.
      expect(screen.getByRole("group", { name: "Calories, 374 before, 362 now" })).toBeTruthy();
      refreshBackend.failsSaves = false;
      fireEvent.click(apply);
      await waitFor(() => {
        expect(onClose).toHaveBeenCalledTimes(1);
      });
      expect(screen.queryByText(SAVE_FAILED_BANNER)).toBeNull();
    });

    it("should do nothing when it is pressed offline, and stay focusable", async () => {
      await showDiff();
      const apply = await applyButton();
      act(() => {
        onlineManager.setOnline(false);
      });

      expect(apply.getAttribute("aria-disabled")).toBe("true");
      expect(apply.hasAttribute("disabled")).toBe(false);
      apply.focus();
      expect(document.activeElement).toBe(apply);
      fireEvent.click(apply);
      await letWorkSettle();
      act(() => {
        onlineManager.setOnline(true);
      });
      await letWorkSettle();

      expect(apply.getAttribute("aria-busy")).toBeNull();
      expect(refreshBackend.saves).toEqual([]);
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe("leaving without applying", () => {
    it("should close and write nothing for Cancel", async () => {
      await showDiff();

      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
      await letWorkSettle();

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(refreshBackend.saves).toEqual([]);
      expect(screen.queryByText("Ingredients refreshed")).toBeNull();
    });

    it("should close and write nothing for Close", async () => {
      await showDiff();

      fireEvent.click(screen.getByRole("button", { name: "Close" }));
      await letWorkSettle();

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(refreshBackend.saves).toEqual([]);
    });

    it("should close and write nothing for Escape", async () => {
      await showDiff();

      fireEvent.keyDown(document, { key: "Escape" });
      await letWorkSettle();

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(refreshBackend.saves).toEqual([]);
    });
  });

  describe("nothing to refresh", () => {
    it("should say so with Done, which closes, and no Apply", async () => {
      seed(foodsAsSaved);
      showDialog();

      expect(await screen.findByRole("heading", { name: REFRESH.nothingTitle })).toBeTruthy();
      expect(screen.getByText(REFRESH.nothingBody)).toBeTruthy();
      expect(screen.queryByRole("button", { name: REFRESH.apply })).toBeNull();
      expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
      expect(screen.queryByText(REFRESH.intro)).toBeNull();

      fireEvent.click(screen.getByRole("button", { name: REFRESH.done }));
      await letWorkSettle();

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(refreshBackend.saves).toEqual([]);
    });
  });

  describe("a deleted food", () => {
    it("should keep the ingredient as it is in its own section, beside the changes", async () => {
      seed(foodsWithTheOilDeleted);
      showDialog();

      await screen.findByRole("region", { name: "Kept as it is" });
      expect(headingTextStartingWith("Kept as it is")).toBe("Kept as it is · 1");
      const kept = within(screen.getByRole("region", { name: "Kept as it is" }));
      expect(kept.getByText("Olive oil")).toBeTruthy();
      expect(kept.getByText("20 g")).toBeTruthy();
      expect(kept.getByText(REFRESH.foodGone)).toBeTruthy();
      expect(headingTextStartingWith("Unchanged")).toBe("Unchanged · 1");
      const unchanged = within(screen.getByRole("region", { name: "Unchanged" }));
      expect(unchanged.getAllByRole("listitem")).toHaveLength(1);
      expect(unchanged.getByText("Long grain rice")).toBeTruthy();
      expect(await applyButton()).toBeTruthy();
    });

    it("should show the kept ingredient above the nothing to refresh state, with no Apply, when it is the only news", async () => {
      seed(oilDeletedOnly);
      showDialog();

      const kept = await screen.findByRole("region", { name: "Kept as it is" });
      expect(within(kept).getByText(REFRESH.foodGone)).toBeTruthy();
      const nothing = screen.getByRole("heading", { name: REFRESH.nothingTitle });
      expect(kept.compareDocumentPosition(nothing)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
      expect(screen.queryByRole("button", { name: REFRESH.apply })).toBeNull();
      expect(screen.getByRole("button", { name: REFRESH.done })).toBeTruthy();
    });
  });

  describe("loading, failing and a recipe that is gone", () => {
    it("should name the wait Checking your foods and offer neither Apply nor Cancel", async () => {
      seed();
      refreshBackend.hangsFoodReads = true;
      showDialog();

      expect(await screen.findByRole("status", { name: REFRESH.loadingLabel })).toBeTruthy();
      expect(screen.queryByRole("button", { name: REFRESH.apply })).toBeNull();
      expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
      expect(screen.getByRole("button", { name: "Close" })).toBeTruthy();
    });

    it("should say the check failed in the fixed words, and check again on Try again", async () => {
      seed();
      refreshBackend.failsFoodReads = true;
      showDialog();

      const failure = await screen.findByRole("alert");
      expect(within(failure).getByRole("heading", { name: REFRESH.loadFailed })).toBeTruthy();
      expect(within(failure).getByText(DIARY_LOAD_FAILED.body)).toBeTruthy();
      expect(screen.queryByText(/raw database text/)).toBeNull();
      expect(screen.queryByRole("button", { name: REFRESH.apply })).toBeNull();

      refreshBackend.failsFoodReads = false;
      fireEvent.click(screen.getByRole("button", { name: RETRY_LABEL }));

      expect(
        await screen.findByRole("region", { name: REFRESH.perServingRegionName }),
      ).toBeTruthy();
      expect(refreshBackend.saves).toEqual([]);
    });

    it("should keep focus in the dialog, on Done, when Try again finds nothing to refresh", async () => {
      seed(foodsAsSaved);
      refreshBackend.failsFoodReads = true;
      showDialog();
      await screen.findByRole("alert");
      refreshBackend.failsFoodReads = false;

      pressTryAgain();

      const done = await screen.findByRole("button", { name: REFRESH.done });
      expect(document.activeElement).toBe(done);
    });

    it("should keep focus in the dialog, on Try again, when the check fails a second time", async () => {
      seed();
      refreshBackend.failsFoodReads = true;
      showDialog();
      await screen.findByRole("alert");

      pressTryAgain();
      await letWorkSettle();

      expect(document.activeElement).toBe(screen.getByRole("button", { name: RETRY_LABEL }));
    });

    it("should close and write nothing for Close on the failure", async () => {
      seed();
      refreshBackend.failsFoodReads = true;
      showDialog();
      await screen.findByRole("alert");

      fireEvent.click(screen.getByRole("button", { name: "Close" }));

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(refreshBackend.saves).toEqual([]);
    });

    it("should say the check failed when the connection drops while the foods are still being checked", async () => {
      seed();
      refreshBackend.hangsFoodReads = true;
      showDialog();
      await screen.findByRole("status", { name: REFRESH.loadingLabel });

      act(() => {
        onlineManager.setOnline(false);
      });

      expect(await screen.findByRole("heading", { name: REFRESH.loadFailed })).toBeTruthy();
    });

    it("should say the recipe is not there when it cannot be found", async () => {
      seed();
      showDialog("66666666-6666-4666-8666-666666666666");

      expect(await screen.findByRole("heading", { name: RECIPE_NOT_FOUND.title })).toBeTruthy();
      expect(screen.queryByRole("button", { name: REFRESH.apply })).toBeNull();
    });
  });

  describe("each time it opens", () => {
    function Harness() {
      const [isOpen, setIsOpen] = useState(true);

      return (
        <>
          <button
            type="button"
            onClick={() => {
              setIsOpen(true);
            }}
          >
            Open it
          </button>
          <RecipeRefreshDialog
            open={isOpen}
            recipeId={REFRESH_RECIPE_ID}
            onClose={() => {
              setIsOpen(false);
            }}
          />
        </>
      );
    }

    it("should check the foods afresh, and never show the diff of an earlier look", async () => {
      seed();
      renderWithRefresh(<Harness />);
      await screen.findByRole("region", { name: REFRESH.perServingRegionName });
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
      expect(screen.queryByRole("dialog")).toBeNull();
      // An unused preview is dropped at once, so the person's next look is a new one.
      await letWorkSettle();
      // The food has been put back since: there is nothing to refresh now.
      refreshBackend.foods = foodsAsSaved;
      const readsBefore = refreshBackend.foodReads;

      fireEvent.click(screen.getByRole("button", { name: "Open it" }));

      // Straight away it is checking, and the earlier diff is not there even for a moment.
      expect(screen.queryByRole("region", { name: REFRESH.perServingRegionName })).toBeNull();
      expect(await screen.findByRole("heading", { name: REFRESH.nothingTitle })).toBeTruthy();
      expect(refreshBackend.foodReads).toBeGreaterThan(readsBefore);
    });
  });
});
