import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeFood, makeOffCandidate, makeSearchHit } from "./support";

import type { FoodSearchResult } from "@keylow/api-client";
import type { Food } from "@keylow/core/schemas";

import { FoodSearch } from "@/components/foods/FoodSearch";

type MaterialiseState = { isPending: boolean; error: Error | null };

const { useFoodSearch, useMaterialiseOffProduct, materialise, push } = vi.hoisted(() => ({
  useFoodSearch: vi.fn<(query: string) => FoodSearchResult>(),
  useMaterialiseOffProduct: vi.fn(),
  materialise:
    vi.fn<(variables: { code: string }, options: { onSuccess: (food: Food) => void }) => void>(),
  push: vi.fn<(href: string) => void>(),
}));

vi.mock("@keylow/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@keylow/api-client")>()),
  useFoodSearch,
  useMaterialiseOffProduct,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

const settled: FoodSearchResult = {
  local: [],
  off: [],
  isLoadingLocal: false,
  isLoadingOff: false,
  offError: null,
  localError: null,
};

function resultWith(changes: Partial<FoodSearchResult>): FoodSearchResult {
  return { ...settled, ...changes };
}

function materialiseState({ isPending = false, error = null }: Partial<MaterialiseState> = {}) {
  useMaterialiseOffProduct.mockReturnValue({ mutate: materialise, isPending, error });
}

function typeQuery(text: string) {
  fireEvent.change(screen.getByLabelText("Search foods"), { target: { value: text } });
}

function search(text: string) {
  typeQuery(text);
  act(() => {
    vi.advanceTimersByTime(250);
  });
}

describe("FoodSearch", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    useFoodSearch.mockReturnValue(settled);
    materialiseState();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  describe("the search field", () => {
    it("should offer a labelled search field and a link to create a food before anything is typed", () => {
      render(<FoodSearch />);

      expect(screen.getByRole("searchbox", { name: "Search foods" })).toBeTruthy();
      expect(screen.getByRole("link", { name: "Create a food" }).getAttribute("href")).toBe(
        "/foods/new",
      );
      expect(useFoodSearch).not.toHaveBeenCalled();
      expect(screen.queryByText("No foods found")).toBeNull();
    });

    it("should wait for the typing to pause before searching", () => {
      render(<FoodSearch />);

      typeQuery("chicken breast");

      expect(useFoodSearch).not.toHaveBeenCalled();
      expect(screen.queryByText("No foods found")).toBeNull();
    });

    it("should search for the trimmed text once the typing has paused", () => {
      render(<FoodSearch />);

      search("  chicken breast ");

      expect(useFoodSearch).toHaveBeenLastCalledWith(
        "chicken breast",
        expect.objectContaining({ debounceMs: 0 }),
      );
    });

    it("should not search for fewer than two characters", () => {
      render(<FoodSearch />);

      search("c");

      expect(useFoodSearch).not.toHaveBeenCalled();
      expect(screen.queryByText("No foods found")).toBeNull();
    });

    it("should stop showing results once the field is cleared", () => {
      useFoodSearch.mockReturnValue(resultWith({ local: [makeSearchHit({ name: "Oat cakes" })] }));
      render(<FoodSearch />);
      search("oat");
      expect(screen.getByText("Oat cakes")).toBeTruthy();

      search("");

      expect(screen.queryByText("Oat cakes")).toBeNull();
    });

    it("should keep the link to create a food when there are results", () => {
      useFoodSearch.mockReturnValue(resultWith({ local: [makeSearchHit()] }));
      render(<FoodSearch />);

      search("oat");

      expect(screen.getByRole("link", { name: "Create a food" })).toBeTruthy();
    });
  });

  describe("local results", () => {
    it("should list each food with its brand, source and energy, linking to its page", () => {
      useFoodSearch.mockReturnValue(
        resultWith({
          local: [
            makeSearchHit({
              id: "food-1",
              name: "Chicken breast, raw",
              brand: "Tesco",
              source: "cofid",
              kcal: 106,
            }),
          ],
        }),
      );
      render(<FoodSearch />);

      search("chicken");

      const link = screen.getByRole("link", { name: /Chicken breast, raw/ });
      expect(link.getAttribute("href")).toBe("/foods/food-1");
      expect(within(link).getByText("Tesco")).toBeTruthy();
      expect(within(link).getByText("CoFID")).toBeTruthy();
      expect(within(link).getByText("106 kcal per 100 g")).toBeTruthy();
    });

    it("should label own foods and Open Food Facts foods by source", () => {
      useFoodSearch.mockReturnValue(
        resultWith({
          local: [
            makeSearchHit({ id: "a", name: "Mine", source: "user" }),
            makeSearchHit({ id: "b", name: "Theirs", source: "off" }),
          ],
        }),
      );
      render(<FoodSearch />);

      search("food");

      expect(within(screen.getByRole("link", { name: /Mine/ })).getByText("Own food")).toBeTruthy();
      expect(
        within(screen.getByRole("link", { name: /Theirs/ })).getByText("Open Food Facts"),
      ).toBeTruthy();
    });

    it("should give the energy per 100 ml for a drink and say so when it is not given", () => {
      useFoodSearch.mockReturnValue(
        resultWith({
          local: [
            makeSearchHit({ id: "a", name: "Oat drink", basis: "per_100ml", kcal: 45 }),
            makeSearchHit({ id: "b", name: "Mystery", kcal: null }),
          ],
        }),
      );
      render(<FoodSearch />);

      search("food");

      expect(screen.getByText("45 kcal per 100 ml")).toBeTruthy();
      expect(screen.getByText("Energy not given")).toBeTruthy();
    });
  });

  describe("Open Food Facts candidates", () => {
    it("should show no Open Food Facts section when there are no candidates", () => {
      useFoodSearch.mockReturnValue(resultWith({ local: [makeSearchHit()] }));
      render(<FoodSearch />);

      search("oat");

      expect(screen.queryByRole("heading", { name: "From Open Food Facts" })).toBeNull();
    });

    it("should show the section under its own heading when there are candidates", () => {
      useFoodSearch.mockReturnValue(
        resultWith({ local: [makeSearchHit()], off: [makeOffCandidate()] }),
      );
      render(<FoodSearch />);

      search("chicken");

      expect(screen.getByRole("heading", { name: "From Open Food Facts" })).toBeTruthy();
      const candidate = screen.getByRole("button", { name: /Chicken breast slices/ });
      expect(within(candidate).getByText("Tesco")).toBeTruthy();
      expect(within(candidate).getByText("105 kcal per 100 g")).toBeTruthy();
    });

    it("should save the candidate once and open its food when it is chosen", () => {
      materialise.mockImplementation((_variables, options) => {
        options.onSuccess(makeFood({ id: "saved-food" }));
      });
      useFoodSearch.mockReturnValue(
        resultWith({ off: [makeOffCandidate({ code: "5000159484695" })] }),
      );
      render(<FoodSearch />);
      search("chicken");

      fireEvent.click(screen.getByRole("button", { name: /Chicken breast slices/ }));

      expect(materialise).toHaveBeenCalledTimes(1);
      expect(materialise).toHaveBeenCalledWith({ code: "5000159484695" }, expect.anything());
      expect(push).toHaveBeenCalledTimes(1);
      expect(push).toHaveBeenCalledWith("/foods/saved-food");
    });

    it("should disable the candidates while one is being saved", () => {
      materialiseState({ isPending: true });
      useFoodSearch.mockReturnValue(
        resultWith({
          off: [makeOffCandidate(), makeOffCandidate({ code: "5000159484701", name: "Other" })],
        }),
      );
      render(<FoodSearch />);
      search("chicken");

      const buttons = within(
        screen.getByRole("region", { name: "From Open Food Facts" }),
      ).getAllByRole("button");
      expect(buttons).toHaveLength(2);
      for (const button of buttons) {
        expect(button).toHaveProperty("disabled", true);
      }
    });

    it("should explain in an alert why a candidate could not be saved and stay on the page", () => {
      materialiseState({ error: new Error("Open Food Facts has no product with that barcode") });
      useFoodSearch.mockReturnValue(resultWith({ off: [makeOffCandidate()] }));
      render(<FoodSearch />);

      search("chicken");

      expect(screen.getByRole("alert").textContent).toContain(
        "Open Food Facts has no product with that barcode",
      );
      expect(push).not.toHaveBeenCalled();
    });
  });

  describe("loading, failures and empty results", () => {
    it("should say the local search is under way", () => {
      useFoodSearch.mockReturnValue(resultWith({ isLoadingLocal: true }));
      render(<FoodSearch />);

      search("chicken");

      expect(screen.getByRole("status").textContent).toBe("Searching foods");
      expect(screen.queryByText("No foods found")).toBeNull();
    });

    it("should say Open Food Facts is being searched without hiding the local results", () => {
      useFoodSearch.mockReturnValue(
        resultWith({ local: [makeSearchHit({ name: "Oat cakes" })], isLoadingOff: true }),
      );
      render(<FoodSearch />);

      search("oat");

      expect(screen.getByRole("status").textContent).toBe("Searching Open Food Facts");
      expect(screen.getByText("Oat cakes")).toBeTruthy();
    });

    it("should show both indicators when both searches are under way", () => {
      useFoodSearch.mockReturnValue(resultWith({ isLoadingLocal: true, isLoadingOff: true }));
      render(<FoodSearch />);

      search("chicken");

      expect(screen.getAllByRole("status").map((status) => status.textContent)).toEqual([
        "Searching foods",
        "Searching Open Food Facts",
      ]);
    });

    it("should keep the local list and say when to retry when Open Food Facts is rate limited", () => {
      useFoodSearch.mockReturnValue(
        resultWith({
          local: [makeSearchHit({ name: "Oat cakes" })],
          offError: { kind: "rate_limited", retryAfterSeconds: 45 },
        }),
      );
      render(<FoodSearch />);

      search("oat");

      expect(screen.getByRole("alert").textContent).toContain("Try again in 45 seconds");
      expect(screen.getByText("Oat cakes")).toBeTruthy();
    });

    it("should say when to retry in general terms when no delay is known", () => {
      useFoodSearch.mockReturnValue(resultWith({ offError: { kind: "rate_limited" } }));
      render(<FoodSearch />);

      search("oat");

      expect(screen.getByRole("alert").textContent).toContain("Try again in a little while");
    });

    it("should show why Open Food Facts could not be searched when it failed", () => {
      useFoodSearch.mockReturnValue(
        resultWith({ offError: { kind: "failed", message: "Upstream is down" } }),
      );
      render(<FoodSearch />);

      search("oat");

      expect(screen.getByRole("alert").textContent).toContain("Upstream is down");
    });

    it("should show a local failure in an alert and not claim there are no results", () => {
      useFoodSearch.mockReturnValue(
        resultWith({ localError: { message: "Could not search the foods: offline" } }),
      );
      render(<FoodSearch />);

      search("oat");

      expect(screen.getByRole("alert").textContent).toContain(
        "Could not search the foods: offline",
      );
      expect(screen.queryByText("No foods found")).toBeNull();
    });

    it("should say no foods were found when both searches are empty", () => {
      render(<FoodSearch />);

      search("zzzz");

      expect(screen.getByText("No foods found")).toBeTruthy();
    });

    it("should not say no foods were found while candidates from Open Food Facts are listed", () => {
      useFoodSearch.mockReturnValue(resultWith({ off: [makeOffCandidate()] }));
      render(<FoodSearch />);

      search("chicken");

      expect(screen.queryByText("No foods found")).toBeNull();
    });

    it("should not say no foods were found while Open Food Facts is still being searched", () => {
      useFoodSearch.mockReturnValue(resultWith({ isLoadingOff: true }));
      render(<FoodSearch />);

      search("chicken");

      expect(screen.queryByText("No foods found")).toBeNull();
    });
  });
});
