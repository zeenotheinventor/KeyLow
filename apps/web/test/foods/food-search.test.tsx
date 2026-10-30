import { OffProductNotFoundError, RateLimitedError } from "@keylow/api-client";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeFood, makeOffCandidate, makeSearchHit } from "./support";

import type { FoodSearchResult, UseFoodByBarcodeReturn } from "@keylow/api-client";
import type { Food } from "@keylow/core/schemas";

import { FoodSearch } from "@/components/foods/FoodSearch";

type MaterialiseState = {
  isPending: boolean;
  error: Error | null;
  variables: { code: string } | undefined;
};

const {
  useFoodSearch,
  useMaterialiseOffProduct,
  useFoodByBarcode,
  materialise,
  push,
  openAddFood,
} = vi.hoisted(() => ({
  useFoodSearch: vi.fn<(query: string) => FoodSearchResult>(),
  useMaterialiseOffProduct: vi.fn(),
  useFoodByBarcode: vi.fn<(code: string) => UseFoodByBarcodeReturn>(),
  materialise: vi.fn<
    (
      variables: { code: string },
      options: {
        onSuccess: (food: Food) => void;
        onError: () => void;
        onSettled?: () => void;
      },
    ) => void
  >(),
  push: vi.fn<(href: string) => void>(),
  openAddFood: vi.fn<(request: { foodId?: string; date?: string }) => void>(),
}));

vi.mock("@keylow/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@keylow/api-client")>()),
  useFoodSearch,
  useMaterialiseOffProduct,
  useFoodByBarcode,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("@/lib/foodLogActions", () => ({
  useFoodLogActions: () => ({ openAddFood }),
}));

const settled: FoodSearchResult = {
  local: [],
  off: [],
  isLoadingLocal: false,
  isLoadingOff: false,
  isDebouncing: false,
  offError: null,
  localError: null,
};

function resultWith(changes: Partial<FoodSearchResult>): FoodSearchResult {
  return { ...settled, ...changes };
}

function materialiseState({
  isPending = false,
  error = null,
  variables,
}: Partial<MaterialiseState> = {}) {
  useMaterialiseOffProduct.mockReturnValue({ mutate: materialise, isPending, error, variables });
}

function searchField() {
  return screen.getByRole("searchbox", { name: "Search foods" });
}

function search(text: string) {
  fireEvent.change(searchField(), { target: { value: text } });
}

function rowsOf(groupName: string) {
  return within(screen.getByRole("region", { name: groupName })).getAllByRole("link");
}

const chickenHits = [
  makeSearchHit({ id: "own-1", name: "Chicken breast, meal prep", source: "user", kcal: 165 }),
  makeSearchHit({ id: "cofid-1", name: "Chicken, breast, grilled", source: "cofid", kcal: 148 }),
  makeSearchHit({ id: "cofid-2", name: "Chicken, breast, roast", source: "cofid", kcal: 147 }),
];

describe("FoodSearch", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    useFoodSearch.mockReturnValue(settled);
    useFoodByBarcode.mockReturnValue({ result: undefined, isLoading: false, error: null });
    materialiseState();
  });

  afterEach(() => {
    cleanup();
  });

  describe("the page before anything is typed", () => {
    it("should title the page and offer to create a food", () => {
      render(<FoodSearch />);

      expect(screen.getByRole("heading", { level: 1, name: "Foods" })).toBeTruthy();
      expect(screen.getByRole("link", { name: "Create a food" }).getAttribute("href")).toBe(
        "/foods/new",
      );
    });

    it("should offer a labelled search field with a hint, focused so typing can start", () => {
      render(<FoodSearch />);

      const field = searchField();
      expect(field.getAttribute("placeholder")).toBe("Name or brand");
      expect(screen.getByText("Type at least 2 characters to search")).toBeTruthy();
      expect(screen.getByText("Search foods", { selector: "label" })).toBeTruthy();
      expect(document.activeElement).toBe(field);
    });

    it("should show no results, no status and no empty state", () => {
      render(<FoodSearch />);

      expect(screen.queryByText("No foods found")).toBeNull();
      expect(screen.queryByText("Values per 100 g unless marked")).toBeNull();
      expect(screen.queryByText("Searching your foods")).toBeNull();
    });

    it("should keep the hint and show nothing for a single character", () => {
      useFoodSearch.mockReturnValue(resultWith({ local: chickenHits }));
      render(<FoodSearch />);

      search("c");

      expect(screen.getByText("Type at least 2 characters to search")).toBeTruthy();
      expect(screen.queryByText("Chicken breast, meal prep")).toBeNull();
      expect(screen.queryByText("No foods found")).toBeNull();
    });

    it("should drop the hint once the text is long enough to search", () => {
      render(<FoodSearch />);

      search("ch");

      expect(screen.queryByText("Type at least 2 characters to search")).toBeNull();
    });

    it("should search for the trimmed text and leave the waiting to the search hook", () => {
      render(<FoodSearch />);

      search("  chicken breast ");

      expect(useFoodSearch).toHaveBeenLastCalledWith("chicken breast");
    });

    it("should stop showing results once the field is cleared", () => {
      useFoodSearch.mockReturnValue(resultWith({ local: chickenHits }));
      render(<FoodSearch />);
      search("chicken");
      expect(screen.getByText(/meal prep/)).toBeTruthy();

      search("");

      expect(screen.queryByText(/meal prep/)).toBeNull();
    });
  });

  describe("waiting for the search", () => {
    it("should say the foods are being searched while the typing has not yet started a search", () => {
      useFoodSearch.mockReturnValue(resultWith({ isDebouncing: true }));
      render(<FoodSearch />);

      search("chicken");

      expect(screen.getByText("Searching your foods").getAttribute("role")).toBe("status");
      expect(screen.queryByText("No foods found")).toBeNull();
    });

    it("should say the foods are being searched while the first results load", () => {
      useFoodSearch.mockReturnValue(resultWith({ isLoadingLocal: true }));
      render(<FoodSearch />);

      search("chicken");

      expect(screen.getByText("Searching your foods").getAttribute("role")).toBe("status");
      expect(screen.queryByText("No foods found")).toBeNull();
      expect(screen.queryByText("Values per 100 g unless marked")).toBeNull();
    });

    it("should keep the earlier results in view, marked busy, while the next search runs", () => {
      useFoodSearch.mockReturnValue(resultWith({ local: chickenHits, isDebouncing: true }));
      render(<FoodSearch />);

      search("chicken b");

      expect(screen.getByText("Searching your foods")).toBeTruthy();
      expect(screen.getByText("Values per 100 g unless marked")).toBeTruthy();
      expect(screen.getByRole("group", { name: "Search results" }).getAttribute("aria-busy")).toBe(
        "true",
      );
      expect(rowsOf("Your foods")).toHaveLength(1);
    });

    it("should not mark the results busy once they have settled", () => {
      useFoodSearch.mockReturnValue(resultWith({ local: chickenHits }));
      render(<FoodSearch />);

      search("chicken");

      expect(
        screen.getByRole("group", { name: "Search results" }).getAttribute("aria-busy"),
      ).toBeNull();
      expect(screen.queryByText("Searching your foods")).toBeNull();
    });

    it("should say Open Food Facts is being searched after the local results", () => {
      useFoodSearch.mockReturnValue(resultWith({ local: chickenHits, isLoadingOff: true }));
      render(<FoodSearch />);

      search("chicken");

      const status = screen.getByText("Searching Open Food Facts");
      expect(status.getAttribute("role")).toBe("status");
      expect(screen.getByText(/meal prep/)).toBeTruthy();
      expect(screen.queryByText("No foods found")).toBeNull();
    });
  });

  describe("local results", () => {
    it("should group the foods as Your foods, Common foods and Branded foods, each with its source", () => {
      useFoodSearch.mockReturnValue(
        resultWith({
          local: [
            makeSearchHit({ id: "b", name: "Savoury Stock Cube", source: "off" }),
            makeSearchHit({ id: "c", name: "Stock cubes, vegetable", source: "cofid" }),
            makeSearchHit({ id: "u", name: "Stock", source: "user" }),
          ],
        }),
      );
      render(<FoodSearch />);

      search("stock");

      const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
      expect(headings).toEqual([
        "Your foods · Yours",
        "Common foods · UK CoFID and USDA",
        "Branded foods · Open Food Facts",
      ]);
      expect(screen.getByText("Values per 100 g unless marked")).toBeTruthy();
    });

    // The test library drops the space at the start of an inline element when it computes a name, so
    // a name written in several bold and plain parts is matched with any space between its words.
    it("should link each food to its page and show its energy and macros", () => {
      useFoodSearch.mockReturnValue(
        resultWith({
          local: [
            makeSearchHit({
              id: "food-1",
              name: "Chicken breast, raw",
              brand: "Tesco",
              source: "cofid",
              kcal: 106,
              protein_g: 23,
              carbs_g: 0,
              fat_g: 1.2,
            }),
          ],
        }),
      );
      render(<FoodSearch />);

      search("chicken");

      const link = screen.getByRole("link", { name: /Chicken\s*breast, raw/ });
      expect(link.getAttribute("href")).toBe("/foods/food-1");
      expect(within(link).getByText("106")).toBeTruthy();
      expect(within(link).getByText(/Tesco/)).toBeTruthy();
      expect(link.textContent).toContain("protein 23 grams, fat 1.2 grams, carbohydrate 0 grams");
    });

    it("should write the words that match the query in bold", () => {
      useFoodSearch.mockReturnValue(resultWith({ local: chickenHits.slice(1, 2) }));
      render(<FoodSearch />);

      search("chicken breast");

      const link = screen.getByRole("link", { name: /Chicken,\s*breast, grilled/ });
      expect(within(link).getByText("Chicken").className).toContain("font-semibold");
      expect(within(link).getByText("breast").className).toContain("font-semibold");
      expect(within(link).getByText(", grilled").className).toContain("font-normal");
    });

    it("should name a per 100 ml basis and say when the energy is not given", () => {
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

      expect(screen.getByText("per 100 ml")).toBeTruthy();
      expect(screen.getByText("Energy not given")).toBeTruthy();
    });

    it("should carry no per row source badge", () => {
      useFoodSearch.mockReturnValue(resultWith({ local: chickenHits }));
      render(<FoodSearch />);

      search("chicken");

      expect(screen.queryByText("Own food")).toBeNull();
      expect(screen.queryByText("CoFID")).toBeNull();
    });

    it("should show three of Your foods and five of each shared group, offering the rest", () => {
      const many = (source: "user" | "cofid" | "off", count: number) =>
        Array.from({ length: count }, (_, index) =>
          makeSearchHit({ id: `${source}-${index}`, name: `${source} food ${index}`, source }),
        );
      useFoodSearch.mockReturnValue(
        resultWith({ local: [...many("user", 5), ...many("cofid", 7), ...many("off", 5)] }),
      );
      render(<FoodSearch />);

      search("food");

      expect(rowsOf("Your foods")).toHaveLength(3);
      expect(rowsOf("Common foods")).toHaveLength(5);
      expect(rowsOf("Branded foods")).toHaveLength(5);
      expect(screen.getByRole("button", { name: "See 2 more in Your foods" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "See 2 more in Common foods" })).toBeTruthy();
      expect(screen.queryByRole("button", { name: /in Branded foods/ })).toBeNull();
    });

    it("should show the rest of a group when See more is pressed, and nothing else changes", () => {
      const many = Array.from({ length: 7 }, (_, index) =>
        makeSearchHit({ id: `c-${index}`, name: `Common food ${index}`, source: "cofid" }),
      );
      useFoodSearch.mockReturnValue(
        resultWith({ local: [...many, makeSearchHit({ id: "u", name: "Mine", source: "user" })] }),
      );
      render(<FoodSearch />);
      search("food");

      fireEvent.click(screen.getByRole("button", { name: "See 2 more in Common foods" }));

      expect(rowsOf("Common foods")).toHaveLength(7);
      expect(rowsOf("Your foods")).toHaveLength(1);
      expect(screen.queryByRole("button", { name: /See \d+ more/ })).toBeNull();
    });

    it("should fold the group again when the query changes", () => {
      const many = Array.from({ length: 7 }, (_, index) =>
        makeSearchHit({ id: `c-${index}`, name: `Common food ${index}`, source: "cofid" }),
      );
      useFoodSearch.mockReturnValue(resultWith({ local: many }));
      render(<FoodSearch />);
      search("food");
      fireEvent.click(screen.getByRole("button", { name: /See 2 more/ }));

      search("food 1");

      expect(rowsOf("Common foods")).toHaveLength(5);
    });
  });

  describe("Open Food Facts candidates", () => {
    const candidates = [
      makeOffCandidate({ code: "5000159484695", name: "Chicken Stock Cubes", brand: "Northfield" }),
      makeOffCandidate({ code: "5000159484701", name: "Beef Stock Cubes", brand: "Northfield" }),
    ];

    it("should list them last, as From Open Food Facts with live results", () => {
      useFoodSearch.mockReturnValue(resultWith({ local: chickenHits, off: candidates }));
      render(<FoodSearch />);

      search("stock cubes");

      const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
      expect(headings.at(-1)).toBe("From Open Food Facts · Live results");
      const region = screen.getByRole("region", { name: "From Open Food Facts" });
      expect(within(region).getAllByRole("button")).toHaveLength(2);
      expect(within(region).getAllByText(/Northfield/)).toHaveLength(2);
    });

    it("should show no such section when there are no candidates", () => {
      useFoodSearch.mockReturnValue(resultWith({ local: chickenHits }));
      render(<FoodSearch />);

      search("chicken");

      expect(screen.queryByRole("region", { name: "From Open Food Facts" })).toBeNull();
    });

    it("should save the candidate once and open its food when it is chosen", () => {
      materialise.mockImplementation((_variables, options) => {
        options.onSuccess(makeFood({ id: "saved-food" }));
      });
      useFoodSearch.mockReturnValue(resultWith({ off: candidates }));
      render(<FoodSearch />);
      search("stock cubes");

      fireEvent.click(screen.getByRole("button", { name: /Chicken\s*Stock\s*Cubes/ }));

      expect(materialise).toHaveBeenCalledTimes(1);
      expect(materialise).toHaveBeenCalledWith({ code: "5000159484695" }, expect.anything());
      expect(push).toHaveBeenCalledTimes(1);
      expect(push).toHaveBeenCalledWith("/foods/saved-food");
    });

    it("should mark the chosen candidate as being added and hold the others still", () => {
      materialiseState({ isPending: true, variables: { code: "5000159484695" } });
      useFoodSearch.mockReturnValue(resultWith({ off: candidates }));
      render(<FoodSearch />);
      search("stock cubes");

      const chosen = screen.getByRole("button", { name: /Chicken\s*Stock\s*Cubes/ });
      const other = screen.getByRole("button", { name: /Beef\s*Stock\s*Cubes/ });
      expect(chosen.getAttribute("aria-busy")).toBe("true");
      expect(within(chosen).getByText("Adding to your foods")).toBeTruthy();
      expect(other.getAttribute("aria-disabled")).toBe("true");

      fireEvent.click(other);
      fireEvent.click(chosen);
      expect(materialise).not.toHaveBeenCalled();
    });

    it("should say in an alert that the product could not be added, and stay on the page", () => {
      materialiseState({ error: new Error("Open Food Facts has no product with that barcode") });
      useFoodSearch.mockReturnValue(resultWith({ off: candidates }));
      render(<FoodSearch />);

      search("stock cubes");

      const alert = screen.getByRole("alert");
      expect(alert.textContent).toContain("This product could not be added");
      expect(alert.textContent).toContain("Check your connection and try again.");
      expect(alert.textContent).not.toContain("no product with that barcode");
      expect(push).not.toHaveBeenCalled();
    });

    it("should say when to try again when adding was rate limited", () => {
      materialiseState({ error: new RateLimitedError("slow down", 30, undefined) });
      useFoodSearch.mockReturnValue(resultWith({ off: candidates }));
      render(<FoodSearch />);

      search("stock cubes");

      const alert = screen.getByRole("alert");
      expect(alert.textContent).toContain("Open Food Facts is busy");
      expect(alert.textContent).toContain("Try again in 30 seconds.");
    });

    it("should say Open Food Facts no longer has the product when it has vanished", () => {
      materialiseState({ error: new OffProductNotFoundError("5000159484701") });
      useFoodSearch.mockReturnValue(resultWith({ off: candidates }));
      render(<FoodSearch />);

      search("stock cubes");

      const alert = screen.getByRole("alert");
      expect(alert.textContent).toContain("Open Food Facts no longer has this product.");
      expect(alert.textContent).not.toContain("could not be added");
      expect(alert.textContent).not.toContain("5000159484701");
    });

    it("should keep the candidates chooseable after a failure so the user can try again", () => {
      materialiseState({ error: new Error("offline") });
      useFoodSearch.mockReturnValue(resultWith({ off: candidates }));
      render(<FoodSearch />);
      search("stock cubes");

      fireEvent.click(screen.getByRole("button", { name: /Beef\s*Stock\s*Cubes/ }));

      expect(materialise).toHaveBeenCalledWith({ code: "5000159484701" }, expect.anything());
    });
  });

  describe("choosing a candidate twice in a row", () => {
    const candidates = [
      makeOffCandidate({ code: "5000159484695", name: "Chicken Stock Cubes" }),
      makeOffCandidate({ code: "5000159484701", name: "Beef Stock Cubes" }),
    ];

    function showCandidates() {
      useFoodSearch.mockReturnValue(resultWith({ off: candidates }));
      render(<FoodSearch />);
      search("stock cubes");
    }

    it("should save once when the same candidate is activated twice before anything re-renders", () => {
      showCandidates();
      const row = screen.getByRole("button", { name: /Chicken\s*Stock\s*Cubes/ });

      fireEvent.click(row);
      fireEvent.click(row);

      expect(materialise).toHaveBeenCalledTimes(1);
    });

    it("should save only the first when two different candidates are activated at once", () => {
      showCandidates();

      fireEvent.click(screen.getByRole("button", { name: /Chicken\s*Stock\s*Cubes/ }));
      fireEvent.click(screen.getByRole("button", { name: /Beef\s*Stock\s*Cubes/ }));

      expect(materialise).toHaveBeenCalledTimes(1);
      expect(materialise).toHaveBeenCalledWith({ code: "5000159484695" }, expect.anything());
    });

    it("should let a new choice through once the first save has failed", () => {
      materialise.mockImplementationOnce((_variables, options) => {
        options.onError();
        options.onSettled?.();
      });
      showCandidates();

      fireEvent.click(screen.getByRole("button", { name: /Chicken\s*Stock\s*Cubes/ }));
      fireEvent.click(screen.getByRole("button", { name: /Chicken\s*Stock\s*Cubes/ }));

      expect(materialise).toHaveBeenCalledTimes(2);
    });

    it("should do nothing on a further choice once the first save has succeeded, while the food opens", () => {
      materialise.mockImplementationOnce((_variables, options) => {
        options.onSuccess(makeFood({ id: "saved-food" }));
        options.onSettled?.();
      });
      showCandidates();

      fireEvent.click(screen.getByRole("button", { name: /Beef\s*Stock\s*Cubes/ }));
      fireEvent.click(screen.getByRole("button", { name: /Beef\s*Stock\s*Cubes/ }));
      fireEvent.click(screen.getByRole("button", { name: /Chicken\s*Stock\s*Cubes/ }));

      expect(materialise).toHaveBeenCalledTimes(1);
      expect(push).toHaveBeenCalledTimes(1);
    });
  });

  describe("when Open Food Facts cannot be searched", () => {
    it("should tell the user, and keep the local results, when it failed", () => {
      useFoodSearch.mockReturnValue(
        resultWith({
          local: chickenHits,
          offError: {
            kind: "failed",
            debugMessage: "Upstream is down",
          },
        }),
      );
      render(<FoodSearch />);

      search("chicken");

      const notice = screen.getByText("Open Food Facts could not be searched right now");
      expect(notice.closest("[role=status]")).toBeTruthy();
      expect(
        screen.getByText("Your own results still work. Change your search to try again."),
      ).toBeTruthy();
      expect(screen.getByText(/meal prep/)).toBeTruthy();
      expect(screen.queryByText(/Upstream is down/)).toBeNull();
    });

    it("should say when to try again when it is rate limited", () => {
      useFoodSearch.mockReturnValue(
        resultWith({
          local: chickenHits,
          offError: { kind: "rate_limited", retryAfterSeconds: 45, debugMessage: "Slow down" },
        }),
      );
      render(<FoodSearch />);

      search("chicken");

      expect(screen.getByText("Open Food Facts is busy")).toBeTruthy();
      expect(screen.getByText("Try again in 45 seconds.")).toBeTruthy();
    });

    it("should say to try again in a moment when no delay is known", () => {
      useFoodSearch.mockReturnValue(
        resultWith({ offError: { kind: "rate_limited", debugMessage: "Slow down" } }),
      );
      render(<FoodSearch />);

      search("chicken");

      expect(screen.getByText("Try again in a moment.")).toBeTruthy();
    });

    it("should not claim a rate limit for another kind of failure", () => {
      useFoodSearch.mockReturnValue(
        resultWith({ offError: { kind: "upstream_error", debugMessage: "Upstream is down" } }),
      );
      render(<FoodSearch />);

      search("chicken");

      expect(screen.queryByText(/busy/)).toBeNull();
    });
  });

  describe("no results and failures", () => {
    it("should say no foods were found when both searches came back empty, and offer to create one", () => {
      render(<FoodSearch />);

      search("zzqx");

      expect(screen.getByRole("heading", { level: 2, name: "No foods found" })).toBeTruthy();
      expect(screen.getByText("Try other words, or create the food yourself.")).toBeTruthy();
      expect(
        screen
          .getAllByRole("link", { name: "Create a food" })
          .map((link) => link.getAttribute("href")),
      ).toEqual(["/foods/new", "/foods/new"]);
      expect(screen.queryByText("Values per 100 g unless marked")).toBeNull();
    });

    it("should show the Open Food Facts notice above the empty state", () => {
      useFoodSearch.mockReturnValue(
        resultWith({ offError: { kind: "failed", debugMessage: "Upstream is down" } }),
      );
      render(<FoodSearch />);

      search("zzqx");

      const notice = screen.getByText("Open Food Facts could not be searched right now");
      const empty = screen.getByText("No foods found");
      expect(notice.compareDocumentPosition(empty) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it("should not say no foods were found while candidates are listed", () => {
      useFoodSearch.mockReturnValue(resultWith({ off: [makeOffCandidate()] }));
      render(<FoodSearch />);

      search("chicken");

      expect(screen.queryByText("No foods found")).toBeNull();
    });

    it.each([
      ["the typing has not started a search", { isDebouncing: true }],
      ["the local search is loading", { isLoadingLocal: true }],
      ["Open Food Facts is being searched", { isLoadingOff: true }],
    ])("should not say no foods were found while %s", (_when, changes) => {
      useFoodSearch.mockReturnValue(resultWith(changes));
      render(<FoodSearch />);

      search("zzqx");

      expect(screen.queryByText("No foods found")).toBeNull();
    });

    it("should say the search failed in an alert, without the raw text, and not claim no results", () => {
      useFoodSearch.mockReturnValue(
        resultWith({ localError: { kind: "failed", debugMessage: "Could not search: offline" } }),
      );
      render(<FoodSearch />);

      search("chicken");

      const alert = screen.getByRole("alert");
      expect(within(alert).getByRole("heading", { name: "Search failed" })).toBeTruthy();
      expect(alert.textContent).toContain(
        "Your foods could not be searched. Check your connection and try again.",
      );
      expect(screen.queryByText(/offline/)).toBeNull();
      expect(screen.queryByText("No foods found")).toBeNull();
    });
  });

  describe("the barcode panel", () => {
    it("should be closed until the barcode button in the search field is pressed", () => {
      render(<FoodSearch />);

      const button = screen.getByRole("button", { name: "Look up a barcode" });
      expect(button.getAttribute("aria-expanded")).toBe("false");
      expect(screen.queryByRole("region", { name: "Barcode lookup" })).toBeNull();

      fireEvent.click(button);

      expect(button.getAttribute("aria-expanded")).toBe("true");
      expect(screen.getByRole("region", { name: "Barcode lookup" })).toBeTruthy();
    });

    it("should hide the search hint while it is open", () => {
      render(<FoodSearch />);

      fireEvent.click(screen.getByRole("button", { name: "Look up a barcode" }));

      expect(screen.queryByText("Type at least 2 characters to search")).toBeNull();
    });

    it("should close from its close button and give the focus back to the search field", () => {
      render(<FoodSearch />);
      fireEvent.click(screen.getByRole("button", { name: "Look up a barcode" }));

      fireEvent.click(screen.getByRole("button", { name: "Close barcode lookup" }));

      expect(screen.queryByRole("region", { name: "Barcode lookup" })).toBeNull();
      expect(document.activeElement).toBe(searchField());
    });

    it("should close when the barcode button is pressed again", () => {
      render(<FoodSearch />);
      const button = screen.getByRole("button", { name: "Look up a barcode" });
      fireEvent.click(button);

      fireEvent.click(button);

      expect(screen.queryByRole("region", { name: "Barcode lookup" })).toBeNull();
    });

    describe("a barcode that finds a food", () => {
      beforeEach(() => {
        useFoodByBarcode.mockReturnValue({
          result: { status: "found", food: makeFood({ id: "found-food" }) },
          isLoading: false,
          error: null,
        });
      });

      function lookUpTypedBarcode() {
        fireEvent.change(screen.getByRole("textbox", { name: "Barcode number" }), {
          target: { value: "5000159484695" },
        });
        fireEvent.click(screen.getByRole("button", { name: "Look up" }));
      }

      it("should start adding that food to the day it was given", () => {
        render(<FoodSearch startWithBarcodePanel day="2026-10-14" />);

        lookUpTypedBarcode();

        expect(openAddFood).toHaveBeenCalledExactlyOnceWith({
          foodId: "found-food",
          date: "2026-10-14",
        });
      });

      it("should start adding it to today when no day was given", () => {
        render(<FoodSearch startWithBarcodePanel />);

        lookUpTypedBarcode();

        expect(openAddFood).toHaveBeenCalledExactlyOnceWith({ foodId: "found-food" });
      });
    });

    it("should start open, with the barcode field focused, when asked to", () => {
      render(<FoodSearch startWithBarcodePanel />);

      expect(screen.getByRole("region", { name: "Barcode lookup" })).toBeTruthy();
      expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Barcode number" }));
      expect(
        screen.getByRole("button", { name: "Look up a barcode" }).getAttribute("aria-expanded"),
      ).toBe("true");
    });
  });
});
