import { act, fireEvent, screen, userEvent, within } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";
import { setUpTests } from "react-native-reanimated";

import { foodFixture, resetApiClientMock } from "./support/apiClientMock";
import { compileFoodSearchStyles } from "./support/foodSearchStyles";
import { renderSheet, sheet } from "./support/renderSheet";
import {
  mockUseFoodSearch,
  ownFoodsResult,
  resetSearchApiClientMock,
} from "./support/searchApiClientMock";
import { resetRouterMock, routerMock } from "../support/expoRouterMock";
import { registerAppStyles } from "../support/nativeWindStyles";

import type { OwnFoodsPaging } from "./support/searchApiClientMock";
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
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<{ default: unknown }>("react-native-safe-area-context/jest/mock").default,
);

// The search sheet guards its plate with a hold on leaving, which needs a navigator. These tests are not about leaving.
jest.mock("expo-router/react-navigation", () => ({ usePreventRemove: () => undefined }));

setUpTests();

function ownFood(id: string, name: string, changes: Partial<Food> = {}): Food {
  return { ...foodFixture, id, name, brand: null, ...changes };
}

// The four foods the your-foods board draws, one of them in millilitres and one with a brand.
const boardFoods = [
  ownFood("a", "Chicken breast, meal prep", { kcal: 165, protein_g: 31, carbs_g: 0, fat_g: 3.6 }),
  ownFood("b", "Cold brew coffee", {
    basis: "per_100ml",
    kcal: 5,
    protein_g: 0.3,
    carbs_g: 0.6,
    fat_g: 0,
  }),
  ownFood("c", "Mystery Spread", {
    brand: "Northfield Mills",
    kcal: 200,
    protein_g: 6.2,
    carbs_g: 20,
    fat_g: 10,
  }),
  ownFood("d", "Overnight oats", { kcal: 152, protein_g: 6.1, carbs_g: 22, fat_g: 4.2 }),
];

function showOwnFoods(foods: Food[], paging?: OwnFoodsPaging) {
  ownFoodsResult.current = { isPending: false, isError: false, data: foods, ...paging };
}

// Scrolls the list the way the device reports it: the list says how tall it is, then it is scrolled.
// `element` is anything inside the list, since the event reaches the list the way a touch on it would.
async function scrollList(
  element: ReturnType<typeof screen.getByRole>,
  offset: number,
  contentHeight = 1000,
) {
  await fireEvent(element, "contentSizeChange", 400, contentHeight);
  await fireEvent.scroll(element, {
    nativeEvent: {
      contentOffset: { x: 0, y: offset },
      contentSize: { width: 400, height: contentHeight },
      layoutMeasurement: { width: 400, height: 600 },
    },
  });
}

const field = () => screen.getByRole("searchbox", { name: "Search foods" });
// The empty state is a view with no role of its own, so it is found by its id to ask for its button.
const emptyStateCreateButton = () =>
  within(screen.getByTestId("empty-state")).getByRole("button", { name: "Create a food" });

async function renderOwnFoods() {
  routerMock.searchParams = { scope: "own" };
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  await renderSheet();
  return user;
}

async function advance(milliseconds: number) {
  await act(() => {
    jest.advanceTimersByTime(milliseconds);
  });
}

describe("food search sheet for your own foods", () => {
  let styles: string;

  beforeAll(async () => {
    styles = await compileFoodSearchStyles();
  });

  beforeEach(() => {
    jest.useFakeTimers();
    registerAppStyles(styles);
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
    resetRouterMock();
    resetApiClientMock();
    resetSearchApiClientMock();
    showOwnFoods(boardFoods);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe("the sheet", () => {
    it("should be titled Your foods, with the same field, scan control and create button", async () => {
      await renderOwnFoods();

      expect(screen.getByRole("heading", { name: "Your foods" })).toBeOnTheScreen();
      expect(field()).toHaveProp("placeholder", "Search for a food");
      expect(screen.getByRole("button", { name: "Scan barcode" })).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Create a food" })).toBeOnTheScreen();
    });

    it("should open the scanner with no log context from the scan control, so a hit opens the add page for now", async () => {
      const user = await renderOwnFoods();

      await user.press(screen.getByRole("button", { name: "Scan barcode" }));

      expect(routerMock.push).toHaveBeenCalledWith("/foods/scan");
    });

    it("should leave the field unfocused, since the list is what the user came for", async () => {
      await renderOwnFoods();

      expect(field()).toHaveProp("autoFocus", false);
    });

    it("should close back to where it was opened", async () => {
      const user = await renderOwnFoods();

      await user.press(screen.getByRole("button", { name: "Close" }));

      expect(routerMock.back).toHaveBeenCalledTimes(1);
    });

    it("should take any other scope for the ordinary sheet", async () => {
      routerMock.searchParams = { scope: "shared" };
      await renderSheet();

      expect(screen.getByRole("heading", { name: "Find food" })).toBeOnTheScreen();
    });
  });

  describe("the list", () => {
    it("should list every own food before anything is typed, in one Your foods group", async () => {
      await renderOwnFoods();

      expect(screen.getByRole("heading", { name: "Your foods · Yours" })).toBeOnTheScreen();
      expect(screen.getAllByRole("heading")).toHaveLength(2);
      expect(screen.getAllByRole("button", { name: /protein/ })).toHaveLength(4);
      expect(screen.getByText("Values per 100 g unless marked")).toBeOnTheScreen();
    });

    it("should draw no hint to type and no idle state", async () => {
      await renderOwnFoods();

      expect(screen.queryByRole("heading", { name: "Search for a food" })).not.toBeOnTheScreen();
      expect(screen.queryByText(/Type at least 2 characters/)).not.toBeOnTheScreen();
    });

    it("should show the rows as the search rows are shown, with the brand and the basis", async () => {
      await renderOwnFoods();

      expect(
        screen.getByRole("button", {
          name: "Mystery Spread, Northfield Mills, protein 6.2 grams, fat 10 grams, carbohydrate 20 grams, 200 kcal",
        }),
      ).toBeOnTheScreen();
      expect(screen.getByText("per 100 ml")).toBeOnTheScreen();
    });

    it("should open the food when a row is pressed", async () => {
      const user = await renderOwnFoods();

      await user.press(screen.getByRole("button", { name: /^Overnight oats/ }));

      expect(routerMock.push).toHaveBeenCalledWith("/foods/d");
    });

    it("should never run the food search, so never reach for shared or Open Food Facts foods", async () => {
      await renderOwnFoods();
      await fireEvent.changeText(field(), "chicken");

      expect(mockUseFoodSearch).not.toHaveBeenCalled();
    });

    it("should list every own food, however many, with no See N more", async () => {
      showOwnFoods(Array.from({ length: 13 }, (_, index) => ownFood(`f${index}`, `Oat ${index}`)));
      await renderOwnFoods();

      expect(screen.getAllByRole("button", { name: /^Oat \d+,/ })).toHaveLength(13);
      expect(screen.queryByRole("button", { name: /See \d+ more/ })).not.toBeOnTheScreen();
    });
  });

  describe("typing", () => {
    it("should narrow the list on the client from the first character", async () => {
      await renderOwnFoods();

      await fireEvent.changeText(field(), "oat");

      expect(screen.getAllByRole("button", { name: /protein/ })).toHaveLength(1);
      expect(screen.getByRole("button", { name: /^Overnight oats/ })).toBeOnTheScreen();
    });

    it("should match the brand as well as the name, and write the typed words in bold", async () => {
      await renderOwnFoods();

      await fireEvent.changeText(field(), "mystery");

      expect(screen.getAllByRole("button", { name: /protein/ })).toHaveLength(1);
      expect(screen.getByText("Mystery")).toHaveStyle({ fontFamily: "Geist-SemiBold" });
    });

    it("should keep the title while narrowing", async () => {
      await renderOwnFoods();

      await fireEvent.changeText(field(), "oat");

      expect(screen.getByRole("heading", { name: "Your foods" })).toBeOnTheScreen();
    });

    it("should say no foods were found, and offer to create one, when nothing matches", async () => {
      const user = await renderOwnFoods();

      await fireEvent.changeText(field(), "zzqx");

      expect(screen.getByRole("heading", { name: "No foods found" })).toBeOnTheScreen();
      expect(screen.queryByRole("heading", { name: "Your foods · Yours" })).not.toBeOnTheScreen();
      expect(screen.getAllByRole("button", { name: "Create a food" })).toHaveLength(2);
      await user.press(emptyStateCreateButton());
      expect(routerMock.push).toHaveBeenCalledWith("/foods/new");
    });
  });

  describe("when there are no own foods", () => {
    beforeEach(() => {
      showOwnFoods([]);
    });

    it("should say there are no foods yet, with a way to create one", async () => {
      const user = await renderOwnFoods();

      expect(screen.getByRole("heading", { name: "No foods yet" })).toBeOnTheScreen();
      expect(screen.getByText("Foods you create or copy appear here.")).toBeOnTheScreen();
      expect(screen.queryByText("Values per 100 g unless marked")).not.toBeOnTheScreen();
      expect(screen.getAllByRole("button", { name: "Create a food" })).toHaveLength(2);
      await user.press(emptyStateCreateButton());
      expect(routerMock.push).toHaveBeenCalledWith("/foods/new");
    });

    it("should still say so when text is typed, never that nothing was found", async () => {
      await renderOwnFoods();

      await fireEvent.changeText(field(), "oat");

      expect(screen.getByRole("heading", { name: "No foods yet" })).toBeOnTheScreen();
      expect(screen.queryByRole("heading", { name: "No foods found" })).not.toBeOnTheScreen();
    });
  });

  describe("while the list loads and when it fails", () => {
    it("should show a skeleton group and never say there are no foods", async () => {
      ownFoodsResult.current = { isPending: true, isError: false, data: undefined };

      await renderOwnFoods();
      await advance(300);

      expect(screen.getByTestId("skeleton", { includeHiddenElements: true })).toBeOnTheScreen();
      expect(screen.queryByRole("heading", { name: "No foods yet" })).not.toBeOnTheScreen();
      expect(screen.queryByRole("heading", { name: "No foods found" })).not.toBeOnTheScreen();
    });

    it("should keep a loaded list when a later refetch fails", async () => {
      ownFoodsResult.current = { isPending: false, isError: true, data: boardFoods };

      await renderOwnFoods();

      expect(screen.getAllByRole("button", { name: /protein/ })).toHaveLength(4);
      expect(screen.queryByRole("alert")).not.toBeOnTheScreen();
    });

    it("should say the foods could not be searched, without any raw text", async () => {
      ownFoodsResult.current = { isPending: false, isError: true, data: undefined };

      await renderOwnFoods();

      expect(
        screen.getByRole("alert", {
          name: "Your foods could not be searched Check your connection and try again.",
        }),
      ).toBeOnTheScreen();
      expect(screen.queryByRole("heading", { name: "No foods yet" })).not.toBeOnTheScreen();
    });
  });

  describe("loading more as the list is scrolled", () => {
    const morePages = (fetchNextPage = jest.fn(), isFetchingNextPage = false) => ({
      hasNextPage: true,
      isFetchingNextPage,
      isFetchNextPageError: false,
      fetchNextPage,
    });
    // Scrolling is sent to a row, and reaches the list the way a touch on the row would.
    const heading = () => screen.getByRole("heading", { name: "Your foods · Yours" });

    it("should load the next page when the list is scrolled to its end", async () => {
      const fetchNextPage = jest.fn();
      showOwnFoods(boardFoods, morePages(fetchNextPage));
      await renderOwnFoods();

      await scrollList(heading(), 400);

      expect(fetchNextPage).toHaveBeenCalledTimes(1);
    });

    it("should not load more while the end of the list is still far away", async () => {
      const fetchNextPage = jest.fn();
      showOwnFoods(boardFoods, morePages(fetchNextPage));
      await renderOwnFoods();

      await scrollList(heading(), 0, 5000);

      expect(fetchNextPage).not.toHaveBeenCalled();
    });

    it("should not try to load more when every food is loaded", async () => {
      const fetchNextPage = jest.fn();
      showOwnFoods(boardFoods, { ...morePages(fetchNextPage), hasNextPage: false });
      await renderOwnFoods();

      await scrollList(heading(), 400);

      expect(fetchNextPage).not.toHaveBeenCalled();
    });

    it("should say more foods are loading, and not ask again, while a page is on its way", async () => {
      const fetchNextPage = jest.fn();
      showOwnFoods(boardFoods, morePages(fetchNextPage, true));
      await renderOwnFoods();

      await scrollList(heading(), 400);

      expect(screen.getByRole("status", { name: "Loading more of your foods" })).toBeOnTheScreen();
      expect(fetchNextPage).not.toHaveBeenCalled();
    });

    it("should say nothing is loading when no page is on its way", async () => {
      showOwnFoods(boardFoods, morePages());
      await renderOwnFoods();

      expect(screen.queryByRole("status")).not.toBeOnTheScreen();
    });

    it("should not keep asking after loading the next page failed", async () => {
      const fetchNextPage = jest.fn();
      showOwnFoods(boardFoods, { ...morePages(fetchNextPage), isFetchNextPageError: true });
      await renderOwnFoods();

      await scrollList(heading(), 400);

      expect(fetchNextPage).not.toHaveBeenCalled();
    });

    it("should keep paging when only a background refetch failed", async () => {
      const fetchNextPage = jest.fn();
      ownFoodsResult.current = {
        isPending: false,
        isError: true,
        data: boardFoods,
        ...morePages(fetchNextPage),
      };
      await renderOwnFoods();

      await scrollList(heading(), 400);

      expect(fetchNextPage).toHaveBeenCalledTimes(1);
    });

    it("should say the page is loading, not that it failed, while a retry is on its way", async () => {
      showOwnFoods(boardFoods, {
        ...morePages(jest.fn(), true),
        isFetchNextPageError: true,
      });
      await renderOwnFoods();

      expect(screen.getByRole("status", { name: "Loading more of your foods" })).toBeOnTheScreen();
      expect(screen.queryByRole("alert")).not.toBeOnTheScreen();
    });

    it("should say the next page could not be loaded at the end of the list, and try again when asked", async () => {
      const fetchNextPage = jest.fn();
      const user = await renderOwnFoods();
      showOwnFoods(boardFoods, { ...morePages(fetchNextPage), isFetchNextPageError: true });
      await screen.rerender(sheet());

      expect(screen.getAllByRole("button", { name: /protein/ })).toHaveLength(4);
      expect(screen.getByRole("alert")).toBeOnTheScreen();
      expect(fetchNextPage).not.toHaveBeenCalled();
      await user.press(screen.getByRole("button", { name: "Try again" }));

      expect(fetchNextPage).toHaveBeenCalledTimes(1);
    });

    describe("while the typed words match nothing so far", () => {
      it("should keep loading, and not say no foods were found, without any scrolling", async () => {
        const fetchNextPage = jest.fn();
        showOwnFoods(boardFoods, morePages(fetchNextPage));
        await renderOwnFoods();

        await fireEvent.changeText(field(), "zzqx");

        expect(screen.queryByRole("heading", { name: "No foods found" })).not.toBeOnTheScreen();
        expect(
          screen.getByRole("status", { name: "Loading more of your foods" }),
        ).toBeOnTheScreen();
        expect(fetchNextPage).toHaveBeenCalledTimes(1);
      });

      it("should ask for the page after each page that also matches nothing", async () => {
        const fetchNextPage = jest.fn();
        showOwnFoods(boardFoods, morePages(fetchNextPage));
        await renderOwnFoods();
        await fireEvent.changeText(field(), "zzqx");
        expect(fetchNextPage).toHaveBeenCalledTimes(1);

        showOwnFoods(boardFoods, morePages(fetchNextPage, true));
        await screen.rerender(sheet());
        showOwnFoods([...boardFoods, ownFood("e", "Pasta bake")], morePages(fetchNextPage));
        await screen.rerender(sheet());

        expect(fetchNextPage).toHaveBeenCalledTimes(2);
        expect(screen.queryByRole("heading", { name: "No foods found" })).not.toBeOnTheScreen();
      });

      it("should say no foods were found once the last page is loaded", async () => {
        showOwnFoods(boardFoods, morePages());
        await renderOwnFoods();
        await fireEvent.changeText(field(), "zzqx");

        showOwnFoods(boardFoods, { ...morePages(), hasNextPage: false });
        await screen.rerender(sheet());

        expect(screen.getByRole("heading", { name: "No foods found" })).toBeOnTheScreen();
      });

      it("should say the page is loading, not that it failed, while a retry is on its way", async () => {
        showOwnFoods(boardFoods, {
          ...morePages(jest.fn(), true),
          isFetchNextPageError: true,
        });
        await renderOwnFoods();
        await fireEvent.changeText(field(), "zzqx");

        expect(
          screen.getByRole("status", { name: "Loading more of your foods" }),
        ).toBeOnTheScreen();
        expect(screen.queryByRole("alert")).not.toBeOnTheScreen();
      });

      it("should stop and offer to try again when a page could not be loaded", async () => {
        const fetchNextPage = jest.fn();
        showOwnFoods(boardFoods, morePages(fetchNextPage));
        const user = await renderOwnFoods();
        await fireEvent.changeText(field(), "zzqx");
        expect(fetchNextPage).toHaveBeenCalledTimes(1);

        showOwnFoods(boardFoods, { ...morePages(fetchNextPage), isFetchNextPageError: true });
        await screen.rerender(sheet());

        expect(fetchNextPage).toHaveBeenCalledTimes(1);
        expect(screen.queryByRole("status")).not.toBeOnTheScreen();
        expect(screen.getByRole("alert")).toBeOnTheScreen();
        await user.press(screen.getByRole("button", { name: "Try again" }));
        expect(fetchNextPage).toHaveBeenCalledTimes(2);
      });
    });
  });
});
