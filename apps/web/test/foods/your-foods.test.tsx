import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeFood } from "./support";

import type { Food } from "@keylow/core/schemas";

import { FoodSearch } from "@/components/foods/FoodSearch";

type Paging = {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isFetchNextPageError: boolean;
  fetchNextPage: () => void;
};

type OwnFoodsState =
  | { isPending: true; isError: false; data: undefined }
  | { isPending: false; isError: true; data: undefined }
  | ({ isPending: false; isError: true; data: Food[] } & Partial<Paging>)
  | ({ isPending: false; isError: false; data: Food[] } & Partial<Paging>);

const { useOwnFoods, useFoodSearch } = vi.hoisted(() => ({
  useOwnFoods: vi.fn<() => OwnFoodsState>(),
  useFoodSearch: vi.fn(),
}));

// jsdom has no IntersectionObserver, so a test scrolls by telling the live observers what they see.
const liveObservers = new Set<(entries: Array<{ isIntersecting: boolean }>) => void>();

class FakeIntersectionObserver {
  private readonly callback: (entries: Array<{ isIntersecting: boolean }>) => void;

  constructor(callback: (entries: Array<{ isIntersecting: boolean }>) => void) {
    this.callback = callback;
  }

  observe() {
    liveObservers.add(this.callback);
  }

  disconnect() {
    liveObservers.delete(this.callback);
  }
}

function scrollToEndOfList() {
  act(() => {
    liveObservers.forEach((callback) => {
      callback([{ isIntersecting: true }]);
    });
  });
}

vi.mock("@keylow/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@keylow/api-client")>()),
  useOwnFoods,
  useFoodSearch,
  useFoodByBarcode: () => ({ result: undefined, isLoading: false, error: null }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/lib/foodLogActions", () => ({
  useFoodLogActions: () => ({ openAddFood: vi.fn() }),
}));

const ownFoods = [
  makeFood({ id: "a", name: "Chicken breast, meal prep", kcal: 165 }),
  makeFood({ id: "b", name: "Cold brew coffee", basis: "per_100ml", kcal: 5 }),
  makeFood({ id: "c", name: "Mystery Spread", brand: "Northfield Mills", kcal: 200 }),
  makeFood({ id: "d", name: "Overnight oats", kcal: 152 }),
];

function showOwnFoods(foods: Food[], paging?: Paging) {
  useOwnFoods.mockReturnValue({ isPending: false, isError: false, data: foods, ...paging });
}

function searchField() {
  return screen.getByRole("searchbox", { name: "Search your foods" });
}

function type(text: string) {
  fireEvent.change(searchField(), { target: { value: text } });
}

function listedNames() {
  return within(screen.getByRole("region", { name: "Your foods" }))
    .getAllByRole("link")
    .map((link) => link.getAttribute("href"));
}

describe("FoodSearch for your own foods", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
    showOwnFoods(ownFoods);
  });

  afterEach(() => {
    cleanup();
    liveObservers.clear();
    vi.unstubAllGlobals();
  });

  it("should be titled Your foods, with a field to search them", () => {
    render(<FoodSearch scope="own" />);

    expect(screen.getByRole("heading", { level: 1, name: "Your foods" })).toBeTruthy();
    expect(searchField().getAttribute("placeholder")).toBe("Name or brand");
    expect(screen.getByRole("link", { name: "Create a food" }).getAttribute("href")).toBe(
      "/foods/new",
    );
  });

  it("should leave the field unfocused, since the list is what the user came for", () => {
    render(<FoodSearch scope="own" />);

    expect(document.activeElement).not.toBe(searchField());
  });

  it("should list every own food before anything is typed, with no hint to type", () => {
    render(<FoodSearch scope="own" />);

    expect(listedNames()).toEqual(["/foods/a", "/foods/b", "/foods/c", "/foods/d"]);
    expect(screen.getByText("Values per 100 g unless marked")).toBeTruthy();
    // The test library drops the space at the start of the source's inline element.
    expect(screen.getByRole("heading", { level: 2, name: /^Your foods\s*· Yours$/ })).toBeTruthy();
    expect(screen.queryByText("Type at least 2 characters to search")).toBeNull();
    expect(screen.queryByRole("button", { name: /See \d+ more/ })).toBeNull();
  });

  it("should show the rows as the search rows are shown, with the brand and the basis", () => {
    render(<FoodSearch scope="own" />);

    expect(screen.getByRole("link", { name: /Mystery Spread/ }).textContent).toContain(
      "Northfield Mills",
    );
    expect(screen.getByText("per 100 ml")).toBeTruthy();
  });

  it("should never run the food search", () => {
    render(<FoodSearch scope="own" />);
    type("chicken");

    expect(useFoodSearch).not.toHaveBeenCalled();
  });

  it("should narrow the list as the user types, from one character", () => {
    render(<FoodSearch scope="own" />);

    type("e");
    expect(listedNames()).toEqual(["/foods/a", "/foods/b", "/foods/c", "/foods/d"]);

    type("oat");
    expect(listedNames()).toEqual(["/foods/d"]);
  });

  it("should match on the brand too, and write the typed words in bold", () => {
    render(<FoodSearch scope="own" />);

    type("northfield");

    expect(listedNames()).toEqual(["/foods/c"]);

    type("mystery");
    expect(
      within(screen.getByRole("link", { name: /Mystery/ })).getByText("Mystery").className,
    ).toContain("font-semibold");
  });

  it("should say no foods were found, and offer to create one, when nothing matches", () => {
    render(<FoodSearch scope="own" />);

    type("zzqx");

    expect(screen.getByRole("heading", { level: 2, name: "No foods found" })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Your foods" })).toBeNull();
    expect(screen.getAllByRole("link", { name: "Create a food" })).toHaveLength(2);
  });

  it("should say there are no foods yet, with a way to create one, when the user has none", () => {
    showOwnFoods([]);
    render(<FoodSearch scope="own" />);

    expect(screen.getByRole("heading", { level: 2, name: "No foods yet" })).toBeTruthy();
    expect(screen.getByText("Foods you create or copy appear here.")).toBeTruthy();
    expect(
      screen
        .getAllByRole("link", { name: "Create a food" })
        .map((link) => link.getAttribute("href")),
    ).toEqual(["/foods/new", "/foods/new"]);
    expect(screen.queryByText("Values per 100 g unless marked")).toBeNull();
  });

  it("should still say there are no foods yet when text is typed and there are none", () => {
    showOwnFoods([]);
    render(<FoodSearch scope="own" />);

    type("oat");

    expect(screen.getByRole("heading", { level: 2, name: "No foods yet" })).toBeTruthy();
  });

  it("should say the list is loading while it loads, never that there are no foods", () => {
    useOwnFoods.mockReturnValue({ isPending: true, isError: false, data: undefined });
    render(<FoodSearch scope="own" />);

    expect(screen.queryByText("No foods yet")).toBeNull();
    expect(screen.queryByText("No foods found")).toBeNull();
  });

  it("should say the search failed, without the raw text, when the list cannot be loaded", () => {
    useOwnFoods.mockReturnValue({ isPending: false, isError: true, data: undefined });
    render(<FoodSearch scope="own" />);

    const alert = screen.getByRole("alert");
    expect(within(alert).getByRole("heading", { name: "Search failed" })).toBeTruthy();
    expect(screen.queryByText("No foods yet")).toBeNull();
  });

  it("should keep the loaded list when a later refetch fails", () => {
    useOwnFoods.mockReturnValue({ isPending: false, isError: true, data: ownFoods });
    render(<FoodSearch scope="own" />);

    expect(screen.queryByRole("alert")).toBeNull();
    expect(listedNames()).toHaveLength(4);
  });

  it("should still offer the barcode lookup", () => {
    render(<FoodSearch scope="own" />);

    fireEvent.click(screen.getByRole("button", { name: "Look up a barcode" }));

    expect(screen.getByRole("region", { name: "Barcode lookup" })).toBeTruthy();
  });

  describe("loading more as the list is scrolled", () => {
    const more = (fetchNextPage = vi.fn(), changes: Partial<Paging> = {}): Paging => ({
      hasNextPage: true,
      isFetchingNextPage: false,
      isFetchNextPageError: false,
      fetchNextPage,
      ...changes,
    });

    it("should load the next page when the end of the list comes into view", () => {
      const fetchNextPage = vi.fn();
      showOwnFoods(ownFoods, more(fetchNextPage));
      render(<FoodSearch scope="own" />);

      expect(fetchNextPage).not.toHaveBeenCalled();
      scrollToEndOfList();

      expect(fetchNextPage).toHaveBeenCalledTimes(1);
    });

    it("should not try to load more when every food is loaded", () => {
      const fetchNextPage = vi.fn();
      showOwnFoods(ownFoods, more(fetchNextPage, { hasNextPage: false }));
      render(<FoodSearch scope="own" />);

      scrollToEndOfList();

      expect(fetchNextPage).not.toHaveBeenCalled();
    });

    it("should say more foods are loading, and not ask again, while a page is on its way", () => {
      const fetchNextPage = vi.fn();
      showOwnFoods(ownFoods, more(fetchNextPage, { isFetchingNextPage: true }));
      render(<FoodSearch scope="own" />);

      scrollToEndOfList();

      expect(screen.getByRole("status").textContent).toBe("Loading more of your foods");
      expect(fetchNextPage).not.toHaveBeenCalled();
    });

    it("should say nothing is loading when no page is on its way", () => {
      showOwnFoods(ownFoods, more());
      render(<FoodSearch scope="own" />);

      expect(screen.queryByRole("status")).toBeNull();
    });

    it("should say the next page could not be loaded, keep the list, and try again when asked", () => {
      const fetchNextPage = vi.fn();
      showOwnFoods(ownFoods, more(fetchNextPage, { isFetchNextPageError: true }));
      render(<FoodSearch scope="own" />);

      scrollToEndOfList();

      expect(fetchNextPage).not.toHaveBeenCalled();
      expect(listedNames()).toHaveLength(4);
      expect(
        within(screen.getByRole("alert")).getByRole("heading", { name: "Search failed" }),
      ).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "Try again" }));
      expect(fetchNextPage).toHaveBeenCalledTimes(1);
    });

    it("should say the page is loading, not that it failed, while a retry is on its way", () => {
      showOwnFoods(
        ownFoods,
        more(vi.fn(), { isFetchingNextPage: true, isFetchNextPageError: true }),
      );
      render(<FoodSearch scope="own" />);

      expect(screen.getByRole("status").textContent).toBe("Loading more of your foods");
      expect(screen.queryByRole("alert")).toBeNull();
    });

    it("should keep paging when only a background refetch failed", () => {
      const fetchNextPage = vi.fn();
      useOwnFoods.mockReturnValue({
        isPending: false,
        isError: true,
        data: ownFoods,
        ...more(fetchNextPage),
      });
      render(<FoodSearch scope="own" />);

      scrollToEndOfList();

      expect(fetchNextPage).toHaveBeenCalledTimes(1);
    });

    describe("while the typed words match nothing so far", () => {
      it("should keep loading, and not say no foods were found", () => {
        const fetchNextPage = vi.fn();
        showOwnFoods(ownFoods, more(fetchNextPage));
        render(<FoodSearch scope="own" />);

        type("zzqx");

        expect(screen.queryByRole("heading", { name: "No foods found" })).toBeNull();
        expect(screen.getByRole("status").textContent).toBe("Loading more of your foods");
        scrollToEndOfList();
        expect(fetchNextPage).toHaveBeenCalledTimes(1);
      });

      it("should ask for the page after each page that also matches nothing", () => {
        const fetchNextPage = vi.fn();
        showOwnFoods(ownFoods, more(fetchNextPage));
        const { rerender } = render(<FoodSearch scope="own" />);
        type("zzqx");
        scrollToEndOfList();

        showOwnFoods(ownFoods, more(fetchNextPage, { isFetchingNextPage: true }));
        rerender(<FoodSearch scope="own" />);
        showOwnFoods([...ownFoods, makeFood({ id: "e", name: "Pasta bake" })], more(fetchNextPage));
        rerender(<FoodSearch scope="own" />);
        scrollToEndOfList();

        expect(fetchNextPage).toHaveBeenCalledTimes(2);
        expect(screen.queryByRole("heading", { name: "No foods found" })).toBeNull();
      });

      it("should say no foods were found once the last page is loaded", () => {
        showOwnFoods(ownFoods, more());
        const { rerender } = render(<FoodSearch scope="own" />);
        type("zzqx");

        showOwnFoods(ownFoods, more(vi.fn(), { hasNextPage: false }));
        rerender(<FoodSearch scope="own" />);

        expect(screen.getByRole("heading", { level: 2, name: "No foods found" })).toBeTruthy();
      });

      it("should stop and offer to try again when a page could not be loaded", () => {
        const fetchNextPage = vi.fn();
        showOwnFoods(ownFoods, more(fetchNextPage, { isFetchNextPageError: true }));
        render(<FoodSearch scope="own" />);

        type("zzqx");
        scrollToEndOfList();

        expect(fetchNextPage).not.toHaveBeenCalled();
        expect(screen.queryByRole("status")).toBeNull();
        expect(screen.getByRole("alert")).toBeTruthy();
        fireEvent.click(screen.getByRole("button", { name: "Try again" }));
        expect(fetchNextPage).toHaveBeenCalledTimes(1);
      });
    });
  });
});
