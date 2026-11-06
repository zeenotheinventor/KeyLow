import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  favouritesBackend,
  holdWrites,
  releaseWrites,
  renderWithFavourites,
  resetFavouritesBackend,
} from "./favouritesBackend";
import { makeFood, makePortion } from "../foods/support";

import type { FoodWithPortionsState } from "@keylow/api-client";
import type { Food } from "@keylow/core/schemas";

import { FoodDetail } from "@/components/foods/FoodDetail";

const { useFoodWithPortions, useRefreshOutdatedOffFood } = vi.hoisted(() => ({
  useFoodWithPortions: vi.fn<(id: string) => FoodWithPortionsState>(),
  useRefreshOutdatedOffFood: vi.fn<(food: Food | undefined) => void>(),
}));

vi.mock("@keylow/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@keylow/api-client")>()),
  useFoodWithPortions,
  useRefreshOutdatedOffFood,
}));

const food = makeFood();

function showFood(isFavourite = false) {
  favouritesBackend.foods.set(food.id, food);
  favouritesBackend.favouriteFoodIds = isFavourite ? [food.id] : [];
  useFoodWithPortions.mockReturnValue({ status: "ready", food, portions: [makePortion()] });
  renderWithFavourites(<FoodDetail id={food.id} />);
}

const addHeart = () => screen.getByRole("button", { name: "Add to favourites" });
const removeHeart = () => screen.getByRole("button", { name: "Remove from favourites" });
const writes = () => favouritesBackend.requests.filter((request) => request.method !== "GET");

describe("the favourite heart on the food detail", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    resetFavouritesBackend();
    onlineManager.setOnline(true);
  });

  afterEach(() => {
    cleanup();
    releaseWrites();
    onlineManager.setOnline(true);
    vi.restoreAllMocks();
  });

  describe("on open", () => {
    it("should offer to add a food that is not a favourite, once the favourites are read", async () => {
      showFood(false);

      await waitFor(() => {
        expect(addHeart().getAttribute("aria-disabled")).toBeNull();
      });
    });

    it("should show the saved state of a favourite, as the phone set it", async () => {
      showFood(true);

      expect(await screen.findByRole("button", { name: "Remove from favourites" })).toBeTruthy();
    });

    it("should be disabled until the favourites have been read, and do nothing when pressed", () => {
      favouritesBackend.hangsReads = true;
      showFood(false);

      expect(addHeart().getAttribute("aria-disabled")).toBe("true");
      fireEvent.click(addHeart());

      expect(writes()).toEqual([]);
      expect(screen.queryByText("Added to favourites")).toBeNull();
    });

    it("should leave out a favourite the shared read has dropped, such as a deleted food", async () => {
      favouritesBackend.favouriteFoodIds = [food.id];
      favouritesBackend.foods = new Map();
      useFoodWithPortions.mockReturnValue({ status: "ready", food, portions: [makePortion()] });
      renderWithFavourites(<FoodDetail id={food.id} />);

      await waitFor(() => {
        expect(addHeart().getAttribute("aria-disabled")).toBeNull();
      });
    });
  });

  describe("a press", () => {
    it("should favourite the food at once and say so in a toast", async () => {
      showFood(false);
      await waitFor(() => {
        expect(addHeart().getAttribute("aria-disabled")).toBeNull();
      });

      fireEvent.click(addHeart());

      expect(await screen.findByRole("button", { name: "Remove from favourites" })).toBeTruthy();
      expect(screen.getByText("Added to favourites")).toBeTruthy();
      await waitFor(() => {
        expect(writes()).toEqual([
          { method: "POST", table: "food_favourites", foodOrRecipeId: food.id },
        ]);
      });
    });

    it("should unfavourite a favourite at once and say so in a toast", async () => {
      showFood(true);
      await screen.findByRole("button", { name: "Remove from favourites" });

      fireEvent.click(removeHeart());

      expect(await screen.findByRole("button", { name: "Add to favourites" })).toBeTruthy();
      expect(screen.getByText("Removed from favourites")).toBeTruthy();
      await waitFor(() => {
        expect(writes()).toEqual([
          { method: "DELETE", table: "food_favourites", foodOrRecipeId: food.id },
        ]);
      });
    });

    it("should toggle once on a double press, however fast the second press comes", async () => {
      holdWrites();
      showFood(false);
      await waitFor(() => {
        expect(addHeart().getAttribute("aria-disabled")).toBeNull();
      });

      fireEvent.click(addHeart());
      fireEvent.click(await screen.findByRole("button", { name: "Remove from favourites" }));
      releaseWrites();

      await waitFor(() => {
        expect(writes()).toHaveLength(1);
      });
      expect(screen.getByRole("button", { name: "Remove from favourites" })).toBeTruthy();
    });

    it("should allow another press once the write has settled", async () => {
      showFood(false);
      await waitFor(() => {
        expect(addHeart().getAttribute("aria-disabled")).toBeNull();
      });

      fireEvent.click(addHeart());
      await screen.findByRole("button", { name: "Remove from favourites" });
      await waitFor(() => {
        expect(writes()).toHaveLength(1);
      });
      await act(async () => {
        await Promise.resolve();
      });
      fireEvent.click(removeHeart());

      await waitFor(() => {
        expect(writes()).toHaveLength(2);
      });
    });
  });

  describe("a write that fails", () => {
    it("should say something went wrong and put the heart back", async () => {
      favouritesBackend.writeOutcome = "fails";
      showFood(false);
      await waitFor(() => {
        expect(addHeart().getAttribute("aria-disabled")).toBeNull();
      });

      fireEvent.click(addHeart());

      expect(await screen.findByText("Something went wrong. Try again.")).toBeTruthy();
      expect(screen.queryByText("Added to favourites")).toBeNull();
      await waitFor(() => {
        expect(addHeart()).toBeTruthy();
      });
    });

    it("should say the cap when the 31st favourite is refused, and put the heart back", async () => {
      favouritesBackend.writeOutcome = "refusesLimit";
      showFood(false);
      await waitFor(() => {
        expect(addHeart().getAttribute("aria-disabled")).toBeNull();
      });

      fireEvent.click(addHeart());

      expect(
        await screen.findByText("You can have up to 30 favourites. Remove one to add another."),
      ).toBeTruthy();
      await waitFor(() => {
        expect(addHeart()).toBeTruthy();
      });
    });

    it("should put a removed favourite back as a favourite", async () => {
      favouritesBackend.writeOutcome = "fails";
      showFood(true);
      await screen.findByRole("button", { name: "Remove from favourites" });

      fireEvent.click(removeHeart());

      expect(await screen.findByText("Something went wrong. Try again.")).toBeTruthy();
      await waitFor(() => {
        expect(removeHeart()).toBeTruthy();
      });
    });

    it("should write nothing about the food or the failure to the console", async () => {
      const logs = [
        vi.spyOn(console, "error").mockImplementation(() => undefined),
        vi.spyOn(console, "warn").mockImplementation(() => undefined),
        vi.spyOn(console, "log").mockImplementation(() => undefined),
      ];
      favouritesBackend.writeOutcome = "fails";
      showFood(false);
      await waitFor(() => {
        expect(addHeart().getAttribute("aria-disabled")).toBeNull();
      });

      fireEvent.click(addHeart());
      await screen.findByText("Something went wrong. Try again.");

      const written = logs.flatMap((log) => log.mock.calls.flat().map(String)).join(" ");
      expect(written).not.toContain(food.name);
      expect(written).not.toContain("database unavailable");
    });
  });

  describe("offline", () => {
    it("should disable the heart and do nothing when pressed", async () => {
      showFood(false);
      await waitFor(() => {
        expect(addHeart().getAttribute("aria-disabled")).toBeNull();
      });

      act(() => {
        onlineManager.setOnline(false);
      });
      fireEvent.click(addHeart());

      expect(addHeart().getAttribute("aria-disabled")).toBe("true");
      expect(writes()).toEqual([]);
    });
  });

  describe("for a keyboard", () => {
    it("should keep focus on the heart after a press, and after a failed write", async () => {
      favouritesBackend.writeOutcome = "fails";
      showFood(false);
      await waitFor(() => {
        expect(addHeart().getAttribute("aria-disabled")).toBeNull();
      });
      addHeart().focus();

      fireEvent.click(addHeart());
      await screen.findByText("Something went wrong. Try again.");

      expect(document.activeElement).toBe(addHeart());
    });

    it("should keep a disabled heart in the tab order, so focus is not lost when it goes offline", async () => {
      showFood(false);
      await waitFor(() => {
        expect(addHeart().getAttribute("aria-disabled")).toBeNull();
      });
      addHeart().focus();

      act(() => {
        onlineManager.setOnline(false);
      });

      expect(document.activeElement).toBe(addHeart());
    });
  });
});
