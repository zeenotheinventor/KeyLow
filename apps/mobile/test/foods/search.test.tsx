import { OffProductNotFoundError, RateLimitedError } from "@keylow/api-client";
import { act, render, screen, userEvent } from "@testing-library/react-native";

import { foodFixture, resetApiClientMock } from "./support/apiClientMock";
import {
  mockMaterialiseOffProduct,
  mockUseFoodSearch,
  offCandidateFixture,
  resetSearchApiClientMock,
  searchResult,
} from "./support/searchApiClientMock";
import FoodSearchRoute from "../../app/foods/index";
import { resetRouterMock, routerMock } from "../support/expoRouterMock";

import type { FoodSearchHit } from "@keylow/api-client";
import type { Food } from "@keylow/core/schemas";

jest.mock(
  "expo-router",
  () => jest.requireActual<{ mockExpoRouter: unknown }>("../support/expoRouterMock").mockExpoRouter,
);
jest.mock(
  "@keylow/api-client",
  () =>
    jest.requireActual<{ mockSearchApiClient: unknown }>("./support/searchApiClientMock")
      .mockSearchApiClient,
);

const sharedFoodId = "55555555-5555-4555-8555-555555555555";
const materialisedFoodId = "66666666-6666-4666-8666-666666666666";

const ownHit: FoodSearchHit = { ...foodFixture, score: 0.9 };
const coFidHit: FoodSearchHit = {
  ...foodFixture,
  id: sharedFoodId,
  source: "cofid",
  source_ref: "11-104",
  owner_id: null,
  name: "Oats, rolled",
  brand: null,
  kcal: null,
  score: 0.7,
};
const materialisedFood: Food = { ...foodFixture, id: materialisedFoodId, source: "off" };

async function advance(milliseconds: number) {
  await act(() => {
    jest.advanceTimersByTime(milliseconds);
  });
}

// The screen waits for the typing to settle before it searches. Each timer that fires sets state,
// and its effect schedules the next timer only once React has rendered, so time passes in steps.
async function settleTyping() {
  await advance(250);
  await advance(1);
  await advance(1);
}

async function renderSearchWithoutSettling(typed: string) {
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  await render(<FoodSearchRoute />);
  await user.type(screen.getByLabelText("Search foods"), typed);
  return user;
}

async function renderSearch(typed = "oat") {
  const user = await renderSearchWithoutSettling(typed);
  await settleTyping();
  return user;
}

describe("food search screen", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetRouterMock();
    resetApiClientMock();
    resetSearchApiClientMock();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("the search field", () => {
    it("should be labelled for screen readers", async () => {
      await renderSearch("");

      expect(screen.getByLabelText("Search foods")).toBeOnTheScreen();
    });

    it("should search for what the user types once the typing has settled", async () => {
      await renderSearch("oat");

      expect(mockUseFoodSearch).toHaveBeenLastCalledWith("oat", { debounceMs: 0 });
    });

    it("should not search while the user is still typing", async () => {
      await renderSearchWithoutSettling("oat");

      expect(mockUseFoodSearch).toHaveBeenLastCalledWith("", { debounceMs: 0 });
    });

    it("should search for the trimmed text", async () => {
      await renderSearch("  oat  ");

      expect(mockUseFoodSearch).toHaveBeenLastCalledWith("oat", { debounceMs: 0 });
    });

    it("should hint at the minimum length before there is enough to search", async () => {
      await renderSearch("o");

      expect(screen.getByText("Type at least 2 characters to search")).toBeOnTheScreen();
    });

    it("should hide the hint and the results until there is enough to search", async () => {
      Object.assign(searchResult, { local: [ownHit] });

      await renderSearch("o");

      expect(screen.queryByRole("button", { name: /Oat bar/ })).not.toBeOnTheScreen();
      expect(screen.queryByText("No foods found")).not.toBeOnTheScreen();
    });

    it("should count only the trimmed text towards the minimum length", async () => {
      await renderSearch(" o ");

      expect(screen.getByText("Type at least 2 characters to search")).toBeOnTheScreen();
    });

    it("should drop the hint once there is enough to search", async () => {
      await renderSearch("oa");

      expect(screen.queryByText("Type at least 2 characters to search")).not.toBeOnTheScreen();
    });
  });

  describe("local results", () => {
    beforeEach(() => {
      Object.assign(searchResult, { local: [ownHit, coFidHit] });
    });

    it("should list each food with its brand, source and energy per 100 g", async () => {
      await renderSearch();

      expect(screen.getByLabelText("Matching foods")).toBeOnTheScreen();
      expect(
        screen.getByRole("button", { name: "Oat bar, Acme, Own food, 420 kcal per 100 g" }),
      ).toBeOnTheScreen();
    });

    it("should say the energy is not given rather than show zero", async () => {
      await renderSearch();

      expect(
        screen.getByRole("button", { name: "Oats, rolled, CoFID, Energy not given" }),
      ).toBeOnTheScreen();
    });

    it("should show the energy per 100 ml for a liquid", async () => {
      Object.assign(searchResult, { local: [{ ...ownHit, basis: "per_100ml" }] });

      await renderSearch();

      expect(
        screen.getByRole("button", { name: "Oat bar, Acme, Own food, 420 kcal per 100 ml" }),
      ).toBeOnTheScreen();
    });

    it("should open the food detail when a row is pressed", async () => {
      const user = await renderSearch();

      await user.press(screen.getByRole("button", { name: /^Oats, rolled/ }));

      expect(routerMock.push).toHaveBeenCalledTimes(1);
      expect(routerMock.push).toHaveBeenCalledWith(`/foods/${sharedFoodId}`);
    });

    it("should not say nothing was found when there are results", async () => {
      await renderSearch();

      expect(screen.queryByText("No foods found")).not.toBeOnTheScreen();
    });
  });

  describe("the Open Food Facts section", () => {
    it("should not appear when there are no candidates", async () => {
      Object.assign(searchResult, { local: [ownHit] });

      await renderSearch();

      expect(screen.queryByRole("header", { name: "From Open Food Facts" })).not.toBeOnTheScreen();
      expect(screen.queryByLabelText("Open Food Facts results")).not.toBeOnTheScreen();
    });

    it("should appear under its own heading when there are candidates", async () => {
      Object.assign(searchResult, { local: [ownHit], off: [offCandidateFixture] });

      await renderSearch();

      expect(screen.getByRole("header", { name: "From Open Food Facts" })).toBeOnTheScreen();
      expect(screen.getByLabelText("Open Food Facts results")).toBeOnTheScreen();
      expect(
        screen.getByRole("button", { name: "Oat drink, Oatly, 46 kcal per 100 ml" }),
      ).toBeOnTheScreen();
    });

    it("should keep the candidates out of the local list", async () => {
      Object.assign(searchResult, { local: [ownHit], off: [offCandidateFixture] });

      await renderSearch();

      expect(screen.getAllByRole("button", { name: /^Oat/ })).toHaveLength(2);
      expect(screen.getByLabelText("Matching foods")).not.toHaveTextContent("Oat drink");
    });

    it("should add the product once and open the food it returns", async () => {
      Object.assign(searchResult, { off: [offCandidateFixture] });
      mockMaterialiseOffProduct.mockResolvedValue(materialisedFood);
      const user = await renderSearch();

      await user.press(screen.getByRole("button", { name: /^Oat drink/ }));

      expect(mockMaterialiseOffProduct).toHaveBeenCalledTimes(1);
      expect(mockMaterialiseOffProduct).toHaveBeenCalledWith({ code: "5000168001234" });
      expect(routerMock.push).toHaveBeenCalledTimes(1);
      expect(routerMock.push).toHaveBeenCalledWith(`/foods/${materialisedFoodId}`);
    });

    it("should disable the candidates and ignore a second press while one is being added", async () => {
      Object.assign(searchResult, {
        off: [
          offCandidateFixture,
          { ...offCandidateFixture, code: "4006381333931", name: "Soya drink" },
        ],
      });
      mockMaterialiseOffProduct.mockReturnValue(new Promise(() => undefined));
      const user = await renderSearch();

      await user.press(screen.getByRole("button", { name: /^Oat drink/ }));
      await user.press(screen.getByRole("button", { name: /^Oat drink/ }));

      expect(mockMaterialiseOffProduct).toHaveBeenCalledTimes(1);
      expect(screen.getByRole("button", { name: /^Oat drink/ })).toBeDisabled();
      expect(screen.getByRole("button", { name: /^Soya drink/ })).toBeDisabled();
      expect(routerMock.push).not.toHaveBeenCalled();
    });

    it("should say the product is being added while it waits", async () => {
      Object.assign(searchResult, { off: [offCandidateFixture] });
      mockMaterialiseOffProduct.mockReturnValue(new Promise(() => undefined));
      const user = await renderSearch();

      await user.press(screen.getByRole("button", { name: /^Oat drink/ }));

      expect(screen.getByText("Adding to your foods")).toBeOnTheScreen();
    });

    it("should show the failure inline, stay put and let the user try again", async () => {
      Object.assign(searchResult, { off: [offCandidateFixture] });
      mockMaterialiseOffProduct.mockRejectedValue(new Error("network down"));
      const user = await renderSearch();

      await user.press(screen.getByRole("button", { name: /^Oat drink/ }));

      expect(
        await screen.findByRole("alert", {
          name: "This product could not be added. Check your connection and try again.",
        }),
      ).toBeOnTheScreen();
      expect(routerMock.push).not.toHaveBeenCalled();
      expect(screen.getByRole("button", { name: /^Oat drink/ })).toBeEnabled();
    });

    it("should say when Open Food Facts is rate limited while adding a product", async () => {
      Object.assign(searchResult, { off: [offCandidateFixture] });
      mockMaterialiseOffProduct.mockRejectedValue(
        new RateLimitedError("slow down", 20, new Error("429")),
      );
      const user = await renderSearch();

      await user.press(screen.getByRole("button", { name: /^Oat drink/ }));

      expect(
        await screen.findByRole("alert", {
          name: "Open Food Facts is busy. Try again in 20 seconds.",
        }),
      ).toBeOnTheScreen();
    });

    it("should say when Open Food Facts no longer has the product", async () => {
      Object.assign(searchResult, { off: [offCandidateFixture] });
      mockMaterialiseOffProduct.mockRejectedValue(new OffProductNotFoundError("5000168001234"));
      const user = await renderSearch();

      await user.press(screen.getByRole("button", { name: /^Oat drink/ }));

      expect(
        await screen.findByRole("alert", {
          name: "Open Food Facts no longer has this product.",
        }),
      ).toBeOnTheScreen();
    });

    it("should clear the failure when the user changes the search", async () => {
      Object.assign(searchResult, { off: [offCandidateFixture] });
      mockMaterialiseOffProduct.mockRejectedValue(new Error("network down"));
      const user = await renderSearch();
      await user.press(screen.getByRole("button", { name: /^Oat drink/ }));
      await screen.findByRole("alert");

      await user.type(screen.getByLabelText("Search foods"), "s");

      expect(screen.queryByRole("alert")).not.toBeOnTheScreen();
    });

    it("should clear the failure when the user tries again", async () => {
      Object.assign(searchResult, { off: [offCandidateFixture] });
      mockMaterialiseOffProduct.mockRejectedValueOnce(new Error("network down"));
      mockMaterialiseOffProduct.mockResolvedValueOnce(materialisedFood);
      const user = await renderSearch();
      await user.press(screen.getByRole("button", { name: /^Oat drink/ }));
      await screen.findByRole("alert");

      await user.press(screen.getByRole("button", { name: /^Oat drink/ }));

      expect(screen.queryByRole("alert")).not.toBeOnTheScreen();
      expect(routerMock.push).toHaveBeenCalledWith(`/foods/${materialisedFoodId}`);
    });
  });

  describe("loading", () => {
    it("should show that the local search is running", async () => {
      Object.assign(searchResult, { isLoadingLocal: true });

      await renderSearch();

      expect(screen.getByRole("progressbar", { name: "Searching your foods" })).toBeOnTheScreen();
      expect(screen.queryByRole("progressbar", { name: "Searching Open Food Facts" })).toBeNull();
    });

    it("should show that the Open Food Facts search is running, apart from the local one", async () => {
      Object.assign(searchResult, { local: [ownHit], isLoadingOff: true });

      await renderSearch();

      expect(
        screen.getByRole("progressbar", { name: "Searching Open Food Facts" }),
      ).toBeOnTheScreen();
      expect(screen.queryByRole("progressbar", { name: "Searching your foods" })).toBeNull();
      expect(screen.getByRole("button", { name: /^Oat bar/ })).toBeOnTheScreen();
    });

    it("should not say nothing was found while a search is still running", async () => {
      Object.assign(searchResult, { isLoadingLocal: true });

      await renderSearch();

      expect(screen.queryByText("No foods found")).not.toBeOnTheScreen();
    });

    it("should not say nothing was found while Open Food Facts is still being searched", async () => {
      Object.assign(searchResult, { isLoadingOff: true });

      await renderSearch();

      expect(screen.queryByText("No foods found")).not.toBeOnTheScreen();
    });
  });

  describe("when Open Food Facts cannot be searched", () => {
    beforeEach(() => {
      Object.assign(searchResult, { local: [ownHit] });
    });

    it("should keep the local results and say how long to wait when rate limited", async () => {
      Object.assign(searchResult, { offError: { kind: "rate_limited", retryAfterSeconds: 30 } });

      await renderSearch();

      expect(
        screen.getByRole("alert", { name: "Open Food Facts is busy. Try again in 30 seconds." }),
      ).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: /^Oat bar/ })).toBeOnTheScreen();
    });

    it("should say one second in the singular", async () => {
      Object.assign(searchResult, { offError: { kind: "rate_limited", retryAfterSeconds: 1 } });

      await renderSearch();

      expect(
        screen.getByRole("alert", { name: "Open Food Facts is busy. Try again in 1 second." }),
      ).toBeOnTheScreen();
    });

    it("should still ask the user to wait when no delay is given", async () => {
      Object.assign(searchResult, { offError: { kind: "rate_limited" } });

      await renderSearch();

      expect(
        screen.getByRole("alert", { name: "Open Food Facts is busy. Try again in a moment." }),
      ).toBeOnTheScreen();
    });

    it("should say the search failed for any other error and keep the local results", async () => {
      Object.assign(searchResult, { offError: { kind: "failed", message: "boom" } });

      await renderSearch();

      expect(
        screen.getByRole("alert", { name: "Open Food Facts could not be searched right now." }),
      ).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: /^Oat bar/ })).toBeOnTheScreen();
    });
  });

  describe("when the local search fails", () => {
    beforeEach(() => {
      Object.assign(searchResult, { localError: { message: "rpc failed" } });
    });

    it("should show an alert", async () => {
      await renderSearch();

      expect(
        screen.getByRole("alert", {
          name: "Your foods could not be searched. Check your connection and try again.",
        }),
      ).toBeOnTheScreen();
    });

    it("should not claim that no foods were found", async () => {
      await renderSearch();

      expect(screen.queryByText("No foods found")).not.toBeOnTheScreen();
    });
  });

  describe("when nothing matches", () => {
    it("should say no foods were found", async () => {
      await renderSearch();

      expect(screen.getByText("No foods found")).toBeOnTheScreen();
    });

    it("should not say so when Open Food Facts has candidates", async () => {
      Object.assign(searchResult, { off: [offCandidateFixture] });

      await renderSearch();

      expect(screen.queryByText("No foods found")).not.toBeOnTheScreen();
    });
  });

  describe("creating a food", () => {
    it("should be offered before anything is typed", async () => {
      await renderSearch("");

      expect(screen.getByRole("button", { name: "Create a food" })).toBeOnTheScreen();
    });

    it("should be offered alongside results", async () => {
      Object.assign(searchResult, { local: [ownHit], off: [offCandidateFixture] });

      await renderSearch();

      expect(screen.getAllByRole("button", { name: "Create a food" })).toHaveLength(1);
    });

    it("should open the new food screen", async () => {
      const user = await renderSearch("");

      await user.press(screen.getByRole("button", { name: "Create a food" }));

      expect(routerMock.push).toHaveBeenCalledTimes(1);
      expect(routerMock.push).toHaveBeenCalledWith("/foods/new");
    });
  });
});
