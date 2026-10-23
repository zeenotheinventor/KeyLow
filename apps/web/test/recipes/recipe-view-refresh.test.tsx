import { RECIPE_ACTIONS, REFRESH, RECIPE_VIEW, describeEditRecipe } from "@keylow/core/copy";
import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "storybook/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  REFRESH_RECIPE_ID,
  chickenAndRice,
  foodsAfterTheChickenEdit,
  foodsAsSaved,
  refreshBackend,
  renderWithRefresh,
  resetRefreshBackend,
} from "./refreshSupport";

import { RecipeViewScreen } from "@/components/recipes";

// The Duplicate and Archive buttons go through the router, which these tests do not use.
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));

beforeEach(() => {
  resetRefreshBackend();
  refreshBackend.recipe = chickenAndRice;
  refreshBackend.foods = foodsAfterTheChickenEdit;
});

afterEach(() => {
  cleanup();
  onlineManager.setOnline(true);
});

async function showView() {
  renderWithRefresh(<RecipeViewScreen id={REFRESH_RECIPE_ID} />);
  await screen.findByRole("heading", { level: 1, name: "Chicken and rice" });
}

const refreshButton = () => screen.getByRole("button", { name: RECIPE_ACTIONS.refresh });
const dialog = () => screen.getByRole("dialog", { name: RECIPE_ACTIONS.refresh });
const perServingCard = () => screen.getByRole("region", { name: "Per serving" });
const servingsField = () => screen.getByRole<HTMLInputElement>("spinbutton", { name: "Servings" });

// A press starts its work after an await, so what a press did not do is only known once that has had its turn.
const letWorkSettle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });

describe("the recipe view's Refresh ingredients button", () => {
  describe("the button", () => {
    it("should sit between Edit and Duplicate, and be a secondary button of its own", async () => {
      await showView();

      const edit = screen.getByRole("link", { name: describeEditRecipe("Chicken and rice") });
      const duplicate = screen.getByRole("button", { name: /^Duplicate / });
      expect(edit.compareDocumentPosition(refreshButton())).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
      expect(refreshButton().compareDocumentPosition(duplicate)).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING,
      );
      expect(refreshButton().textContent).toBe(RECIPE_ACTIONS.refresh);
    });

    it("should be there on an archived recipe too, as Duplicate is", async () => {
      refreshBackend.recipe = { ...chickenAndRice, is_archived: true };
      await showView();

      expect(refreshButton()).toBeTruthy();
    });

    it("should open the dialog over the view, which stays", async () => {
      await showView();

      fireEvent.click(refreshButton());

      expect(dialog()).toBeTruthy();
      expect(
        await screen.findByRole("region", { name: REFRESH.perServingRegionName }),
      ).toBeTruthy();
      expect(screen.getByRole("heading", { level: 1, name: "Chicken and rice" })).toBeTruthy();
    });
  });

  describe("the dialog", () => {
    it("should close with nothing written for Cancel, and give focus back to the button", async () => {
      await showView();
      // A click moves focus to the button in a browser, which a fired click does not.
      refreshButton().focus();
      fireEvent.click(refreshButton());
      await screen.findByRole("region", { name: REFRESH.perServingRegionName });

      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

      expect(screen.queryByRole("dialog")).toBeNull();
      expect(document.activeElement).toBe(refreshButton());
      expect(refreshBackend.saves).toEqual([]);
      expect(screen.queryByText("Ingredients refreshed")).toBeNull();
    });

    it("should check the foods afresh each time it opens", async () => {
      await showView();
      fireEvent.click(refreshButton());
      await screen.findByRole("region", { name: REFRESH.perServingRegionName });
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
      await letWorkSettle();
      refreshBackend.foods = foodsAsSaved;

      fireEvent.click(refreshButton());

      expect(await screen.findByRole("heading", { name: REFRESH.nothingTitle })).toBeTruthy();
      expect(screen.queryByRole("region", { name: REFRESH.perServingRegionName })).toBeNull();
    });

    it("should refresh the card and leave the servings alone, saying so in a toast on the view", async () => {
      await showView();
      fireEvent.click(screen.getByRole("button", { name: RECIPE_VIEW.moreServings }));
      fireEvent.click(screen.getByRole("button", { name: RECIPE_VIEW.moreServings }));
      expect(servingsField().value).toBe("6");
      expect(within(perServingCard()).getByText("374")).toBeTruthy();

      fireEvent.click(refreshButton());
      await screen.findByRole("region", { name: REFRESH.perServingRegionName });
      fireEvent.click(screen.getByRole("button", { name: REFRESH.apply }));

      expect(await screen.findByText("Ingredients refreshed")).toBeTruthy();
      await waitFor(() => {
        expect(screen.queryByRole("dialog")).toBeNull();
      });
      await waitFor(() => {
        expect(within(perServingCard()).getByText("362")).toBeTruthy();
      });
      expect(servingsField().value).toBe("6");
      expect(servingsField().getAttribute("aria-valuetext")).toBe("6 servings");
      expect(screen.getByRole("listitem", { name: "Chicken breast fillets, 750 g" })).toBeTruthy();
      expect(screen.getByText("Makes 6 · 1,650 g cooked")).toBeTruthy();
      expect(refreshBackend.saves).toHaveLength(1);
    });
  });

  describe("offline", () => {
    async function offlineButton() {
      await showView();
      act(() => {
        onlineManager.setOnline(false);
      });

      return refreshButton();
    }

    it("should say it is disabled, take no pointer and stay in the tab order", async () => {
      const button = await offlineButton();

      expect(button.getAttribute("aria-disabled")).toBe("true");
      expect(button.hasAttribute("disabled")).toBe(false);
      expect(button.classList.contains("aria-disabled:pointer-events-none")).toBe(true);
      button.focus();
      expect(document.activeElement).toBe(button);
    });

    it("should open nothing when it is pressed with the pointer or the keyboard", async () => {
      const button = await offlineButton();
      const reads = refreshBackend.recipeReads;
      button.focus();

      fireEvent.click(button);
      await userEvent.keyboard("{Enter}");
      await userEvent.keyboard(" ");
      await letWorkSettle();

      expect(screen.queryByRole("dialog")).toBeNull();
      expect(refreshBackend.recipeReads).toBe(reads);
      expect(refreshBackend.foodReads).toBe(0);
    });

    it("should work again when the connection comes back", async () => {
      const button = await offlineButton();
      act(() => {
        onlineManager.setOnline(true);
      });

      fireEvent.click(button);

      expect(dialog()).toBeTruthy();
      expect(button.getAttribute("aria-disabled")).toBeNull();
    });
  });
});
