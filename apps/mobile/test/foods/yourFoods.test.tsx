import { act, fireEvent, screen, userEvent, within } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";
import { setUpTests } from "react-native-reanimated";

import { foodFixture, resetApiClientMock } from "./support/apiClientMock";
import { compileFoodSearchStyles } from "./support/foodSearchStyles";
import { renderSheet } from "./support/renderSheet";
import {
  mockUseFoodSearch,
  ownFoodsResult,
  resetSearchApiClientMock,
} from "./support/searchApiClientMock";
import { resetRouterMock, routerMock } from "../support/expoRouterMock";
import { registerAppStyles } from "../support/nativeWindStyles";

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

function showOwnFoods(foods: Food[]) {
  ownFoodsResult.current = { isPending: false, isError: false, data: foods };
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
});
