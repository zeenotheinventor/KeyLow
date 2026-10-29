import { OffProductNotFoundError, RateLimitedError } from "@keylow/api-client";
import { touchTarget } from "@keylow/tokens";
import { act, fireEvent, screen, userEvent, waitFor, within } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";
import { getAnimatedStyle, setUpTests } from "react-native-reanimated";

import { foodFixture, resetApiClientMock } from "./support/apiClientMock";
import { compileFoodSearchStyles } from "./support/foodSearchStyles";
import { renderSheet, sheet } from "./support/renderSheet";
import {
  mockMaterialiseOffProduct,
  mockUseFoodSearch,
  mockUseOwnFoods,
  offCandidateFixture,
  resetSearchApiClientMock,
  searchResult,
} from "./support/searchApiClientMock";
import { animatedRotation } from "../support/animatedStyle";
import { resetRouterMock, routerMock } from "../support/expoRouterMock";
import { registerAppStyles } from "../support/nativeWindStyles";

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
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
// The real provider renders nothing until the device reports its insets.
jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<{ default: unknown }>("react-native-safe-area-context/jest/mock").default,
);

// The search sheet guards its plate with a hold on leaving, which needs a navigator. These tests are not about leaving.
jest.mock("expo-router/react-navigation", () => ({ usePreventRemove: () => undefined }));

setUpTests();

const sharedFoodId = "55555555-5555-4555-8555-555555555555";
const materialisedFoodId = "66666666-6666-4666-8666-666666666666";

function hit(changes: Partial<FoodSearchHit>): FoodSearchHit {
  return {
    id: foodFixture.id,
    source: foodFixture.source,
    name: foodFixture.name,
    brand: foodFixture.brand,
    basis: foodFixture.basis,
    kcal: foodFixture.kcal,
    protein_g: foodFixture.protein_g,
    fat_g: foodFixture.fat_g,
    carbs_g: foodFixture.carbs_g,
    fibre_g: foodFixture.fibre_g,
    quality: foodFixture.quality,
    default_portion_id: null,
    default_portion_label: null,
    default_portion_grams: null,
    default_portion_ml: null,
    score: 0.9,
    ...changes,
  };
}

const ownHit = hit({});
const coFidHit = hit({
  id: sharedFoodId,
  source: "cofid",
  name: "Oats, rolled",
  brand: null,
  kcal: null,
  score: 0.7,
});
const materialisedFood: Food = { ...foodFixture, id: materialisedFoodId, source: "off" };

const ownRowName =
  "Oat bar, Acme, protein 8.5 grams, fat 14 grams, carbohydrate 62 grams, 420 kcal";

function setReduceMotion(isEnabled: boolean): void {
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(isEnabled);
}

async function advance(milliseconds: number) {
  await act(() => {
    jest.advanceTimersByTime(milliseconds);
  });
}

const field = () => screen.getByRole("searchbox", { name: "Search foods" });

async function renderSearch(typed = "oat") {
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  await renderSheet();
  if (typed !== "") {
    await fireEvent.changeText(field(), typed);
  }
  return user;
}

const createButtons = () => screen.getAllByRole("button", { name: "Create a food" });
// The empty state is a view with no role of its own, so it is found by its id to ask for its button.
const emptyStateCreateButton = () =>
  within(screen.getByTestId("empty-state")).getByRole("button", { name: "Create a food" });

describe("food search sheet", () => {
  let styles: string;

  beforeAll(async () => {
    styles = await compileFoodSearchStyles();
  });

  beforeEach(() => {
    jest.useFakeTimers();
    registerAppStyles(styles);
    setReduceMotion(false);
    resetRouterMock();
    resetApiClientMock();
    resetSearchApiClientMock();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe("the header", () => {
    it("should be titled Find food, as a heading", async () => {
      await renderSearch("");

      expect(screen.getByRole("heading", { name: "Find food" })).toBeOnTheScreen();
    });

    it("should close the sheet and return to where it was opened", async () => {
      const user = await renderSearch("");

      await user.press(screen.getByRole("button", { name: "Close" }));

      expect(routerMock.back).toHaveBeenCalledTimes(1);
      expect(routerMock.replace).not.toHaveBeenCalled();
    });

    it("should go to the dashboard when the sheet was opened with nowhere to go back to", async () => {
      routerMock.canGoBack.mockReturnValue(false);
      const user = await renderSearch("");

      await user.press(screen.getByRole("button", { name: "Close" }));

      expect(routerMock.back).not.toHaveBeenCalled();
      expect(routerMock.replace).toHaveBeenCalledWith("/(tabs)/dashboard");
    });

    it("should offer to create a food before anything is typed and alongside results", async () => {
      await renderSearch("");
      expect(createButtons()).toHaveLength(1);

      Object.assign(searchResult, { local: [ownHit], off: [offCandidateFixture] });
      await fireEvent.changeText(field(), "oat");

      expect(createButtons()).toHaveLength(1);
    });

    it("should open the new food screen", async () => {
      const user = await renderSearch("");

      await user.press(screen.getByRole("button", { name: "Create a food" }));

      expect(routerMock.push).toHaveBeenCalledTimes(1);
      expect(routerMock.push).toHaveBeenCalledWith("/foods/new");
    });

    it("should be 44 points tall at its buttons, so they are touch targets", async () => {
      await renderSearch("");

      for (const name of ["Close", "Create a food"]) {
        expect(screen.getByRole("button", { name })).toHaveStyle({
          height: touchTarget,
          width: touchTarget,
        });
      }
    });

    it("should reach a 44 point touch target at the scan control, which is smaller", async () => {
      await renderSearch("");

      expect(screen.getByRole("button", { name: "Scan barcode" })).toHaveProp("hitSlop", 4);
    });
  });

  describe("the search field", () => {
    it("should be labelled for screen readers and ask for a food", async () => {
      await renderSearch("");

      expect(field()).toBeOnTheScreen();
      expect(field()).toHaveProp("placeholder", "Search for a food");
    });

    it("should open the keyboard with the sheet", async () => {
      await renderSearch("");

      expect(field()).toHaveProp("autoFocus", true);
    });

    it("should open the barcode scanner from its trailing control", async () => {
      const user = await renderSearch("");

      await user.press(screen.getByRole("button", { name: "Scan barcode" }));

      expect(routerMock.push).toHaveBeenCalledTimes(1);
      expect(routerMock.push).toHaveBeenCalledWith("/foods/scan");
    });

    it("should not load the user's own foods, which only Your foods needs", async () => {
      await renderSearch("oat");

      expect(mockUseOwnFoods).not.toHaveBeenCalled();
    });

    it("should draw no control to clear it, as the boards have none", async () => {
      await renderSearch("oat");

      expect(screen.queryByRole("button", { name: /clear/i })).not.toBeOnTheScreen();
    });

    it("should search for the trimmed text and leave the waiting to the search hook", async () => {
      await renderSearch("  oat  ");

      expect(mockUseFoodSearch).toHaveBeenLastCalledWith("oat");
    });
  });

  describe("idle", () => {
    it("should ask for a food and say how many characters it needs", async () => {
      await renderSearch("");

      expect(screen.getByRole("heading", { name: "Search for a food" })).toBeOnTheScreen();
      expect(
        screen.getByText(
          "Type at least 2 characters to search your foods, UK CoFID, USDA and Open Food Facts.",
        ),
      ).toBeOnTheScreen();
    });

    it("should stay idle for one character or for spaces, and hide any results", async () => {
      Object.assign(searchResult, { local: [ownHit] });
      await renderSearch("o");

      expect(screen.getByRole("heading", { name: "Search for a food" })).toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: /Oat bar/ })).not.toBeOnTheScreen();

      await fireEvent.changeText(field(), " o ");
      expect(screen.getByRole("heading", { name: "Search for a food" })).toBeOnTheScreen();
    });

    it("should drop the idle state once there is enough to search", async () => {
      await renderSearch("oa");

      expect(screen.queryByRole("heading", { name: "Search for a food" })).not.toBeOnTheScreen();
    });
  });

  describe("loading", () => {
    beforeEach(() => {
      Object.assign(searchResult, { isLoadingLocal: true });
    });

    it("should say it is searching your foods and show a skeleton group", async () => {
      await renderSearch();

      expect(screen.getByRole("status", { name: "Searching your foods" })).toBeOnTheScreen();
      // The skeleton is decoration for screen readers and has no role, so it is found by its id.
      expect(screen.getByTestId("skeleton", { includeHiddenElements: true })).toBeOnTheScreen();
      expect(screen.queryByRole("status", { name: "Searching Open Food Facts" })).toBeNull();
    });

    it("should not say nothing was found while the local search runs", async () => {
      await renderSearch();

      expect(screen.queryByRole("heading", { name: "No foods found" })).not.toBeOnTheScreen();
    });

    it("should count the gap before the search starts as searching, with no flicker of nothing found", async () => {
      Object.assign(searchResult, { isLoadingLocal: false, isDebouncing: true });

      await renderSearch();

      expect(screen.getByRole("status", { name: "Searching your foods" })).toBeOnTheScreen();
      expect(screen.queryByRole("heading", { name: "No foods found" })).not.toBeOnTheScreen();
    });

    it("should turn its spinner round", async () => {
      await renderSearch();
      const spinner = () =>
        screen.getByTestId("search-status-spinner", { includeHiddenElements: true });
      await advance(100);
      const early = animatedRotation(spinner());

      await advance(250);

      expect(animatedRotation(spinner())).not.toBe(early);
    });

    it("should not turn the spinner when the user has reduced motion on", async () => {
      setReduceMotion(true);
      await renderSearch();
      await advance(100);
      const spinner = screen.getByTestId("search-status-spinner", { includeHiddenElements: true });
      const opacities = new Set<unknown>();

      for (let step = 0; step < 8; step += 1) {
        opacities.add(getAnimatedStyle(spinner).opacity);
        await advance(100);
      }

      expect(animatedRotation(spinner)).toBe("0deg");
      expect(opacities.size).toBeGreaterThan(1);
    });
  });

  describe("results", () => {
    const stock = (id: string, source: Food["source"], name: string): FoodSearchHit =>
      hit({
        id,
        source,
        name,
        brand: null,
      });

    it("should group by source in the frame's order, whatever order the search ranks them in", async () => {
      Object.assign(searchResult, {
        local: [
          stock("b1", "off", "Oat biscuit"),
          stock("c1", "cofid", "Oats, rolled"),
          stock("y1", "user", "Oat bar"),
        ],
        off: [offCandidateFixture],
      });

      await renderSearch();

      const headings = screen.getAllByRole("heading");
      expect(headings).toHaveLength(5);
      expect(headings[1]).toHaveTextContent("Your foods · Yours");
      expect(headings[2]).toHaveTextContent("Common foods · UK CoFID and USDA");
      expect(headings[3]).toHaveTextContent("Branded foods · Open Food Facts");
      expect(headings[4]).toHaveTextContent("From Open Food Facts · Live results");
    });

    it("should leave out a group with no rows", async () => {
      Object.assign(searchResult, { local: [stock("c1", "cofid", "Oats, rolled")] });

      await renderSearch();

      expect(
        screen.getByRole("heading", { name: "Common foods · UK CoFID and USDA" }),
      ).toBeOnTheScreen();
      expect(screen.queryByRole("heading", { name: /^Your foods/ })).not.toBeOnTheScreen();
      expect(screen.queryByRole("heading", { name: /^Branded foods/ })).not.toBeOnTheScreen();
      expect(
        screen.queryByRole("heading", { name: /^From Open Food Facts/ }),
      ).not.toBeOnTheScreen();
    });

    it("should say the values are per 100 g unless marked", async () => {
      Object.assign(searchResult, { local: [ownHit] });

      await renderSearch();

      expect(screen.getByText("Values per 100 g unless marked")).toBeOnTheScreen();
    });

    it("should name a row with its brand, its macros spelled out and its energy", async () => {
      Object.assign(searchResult, { local: [ownHit] });

      await renderSearch();

      expect(screen.getByRole("button", { name: ownRowName })).toBeOnTheScreen();
    });

    it("should say the energy is not given rather than show zero", async () => {
      Object.assign(searchResult, { local: [coFidHit] });

      await renderSearch();

      expect(
        screen.getByRole("button", { name: "Oats, rolled, Energy not given" }),
      ).toBeOnTheScreen();
      expect(screen.getByText("Energy not given")).toBeOnTheScreen();
    });

    it("should write the matched words in bold and the rest in regular", async () => {
      Object.assign(searchResult, { local: [hit({ name: "Oat bar, rolled", brand: null })] });

      await renderSearch("oat");

      expect(screen.getByText("Oat")).toHaveStyle({ fontFamily: "Geist-SemiBold" });
      expect(screen.getByText(" bar, rolled")).toHaveStyle({ fontFamily: "Geist-Regular" });
    });

    it("should show a food per 100 ml as such", async () => {
      Object.assign(searchResult, { local: [hit({ basis: "per_100ml" })] });

      await renderSearch();

      expect(screen.getByText("per 100 ml")).toBeOnTheScreen();
    });

    it("should draw no source badge on a row, as the group says where it comes from", async () => {
      Object.assign(searchResult, { local: [ownHit, coFidHit] });

      await renderSearch();

      expect(screen.queryByText("Own food")).not.toBeOnTheScreen();
      expect(screen.queryByText("CoFID")).not.toBeOnTheScreen();
    });

    it("should open the food when a row is pressed", async () => {
      Object.assign(searchResult, { local: [ownHit, coFidHit] });
      const user = await renderSearch();

      await user.press(screen.getByRole("button", { name: /^Oats, rolled/ }));

      expect(routerMock.push).toHaveBeenCalledTimes(1);
      expect(routerMock.push).toHaveBeenCalledWith(`/foods/${sharedFoodId}`);
    });

    it("should not say nothing was found when there are results", async () => {
      Object.assign(searchResult, { local: [ownHit] });

      await renderSearch();

      expect(screen.queryByRole("heading", { name: "No foods found" })).not.toBeOnTheScreen();
    });
  });

  describe("See N more", () => {
    const own = (index: number) => hit({ id: `own-${index}`, name: `Oat ${index}`, brand: null });
    const shared = (index: number) =>
      hit({
        id: `shared-${index}`,
        name: `Oat meal ${index}`,
        brand: null,
        source: "cofid",
      });

    beforeEach(() => {
      Object.assign(searchResult, {
        // Five of Your foods against a limit of three, seven of Common foods against five.
        local: [1, 2, 3, 4, 5].map(own).concat([1, 2, 3, 4, 5, 6, 7].map(shared)),
      });
    });

    it("should show three of Your foods and five of Common foods, with the hidden count beside each heading", async () => {
      await renderSearch();

      expect(screen.getAllByRole("button", { name: /^Oat \d/ })).toHaveLength(3);
      expect(screen.getAllByRole("button", { name: /^Oat meal \d/ })).toHaveLength(5);
      expect(screen.getByRole("button", { name: "See 2 more in Your foods" })).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "See 2 more in Common foods" })).toBeOnTheScreen();
    });

    it("should reveal only its own group, then offer nothing more there", async () => {
      const user = await renderSearch();

      await user.press(screen.getByRole("button", { name: "See 2 more in Your foods" }));

      expect(screen.getAllByRole("button", { name: /^Oat \d/ })).toHaveLength(5);
      expect(screen.getAllByRole("button", { name: /^Oat meal \d/ })).toHaveLength(5);
      expect(
        screen.queryByRole("button", { name: "See 2 more in Your foods" }),
      ).not.toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "See 2 more in Common foods" })).toBeOnTheScreen();
    });

    it("should fold back when the user searches for something else", async () => {
      const user = await renderSearch();
      await user.press(screen.getByRole("button", { name: "See 2 more in Your foods" }));

      await fireEvent.changeText(field(), "oats");

      expect(screen.getAllByRole("button", { name: /^Oat \d/ })).toHaveLength(3);
      expect(screen.getByRole("button", { name: "See 2 more in Your foods" })).toBeOnTheScreen();
    });

    it("should offer nothing for a group that shows every row", async () => {
      Object.assign(searchResult, { local: [own(1), own(2)] });

      await renderSearch();

      expect(screen.queryByRole("button", { name: /See \d+ more/ })).not.toBeOnTheScreen();
    });
  });

  describe("refining", () => {
    beforeEach(() => {
      Object.assign(searchResult, { local: [ownHit], isLoadingLocal: true });
    });

    it("should keep the previous results in view under a status line, dimmed to half", async () => {
      await renderSearch();

      expect(screen.getByRole("status", { name: "Searching your foods" })).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: ownRowName })).toBeOnTheScreen();
      expect(screen.getByLabelText("Search results")).toHaveStyle({ opacity: 0.5 });
      expect(screen.getByLabelText("Search results")).toBeBusy();
      expect(screen.queryByTestId("skeleton", { includeHiddenElements: true })).toBeNull();
    });

    it("should keep the note about values at full strength", async () => {
      await renderSearch();

      expect(screen.getByText("Values per 100 g unless marked")).not.toHaveStyle({ opacity: 0.5 });
    });

    it("should bring the results back to full strength once the search settles", async () => {
      await renderSearch();
      Object.assign(searchResult, { isLoadingLocal: false });

      await fireEvent.changeText(field(), "oats");

      expect(screen.getByLabelText("Search results")).not.toBeBusy();
      expect(screen.getByLabelText("Search results")).not.toHaveStyle({ opacity: 0.5 });
      expect(screen.queryByRole("status", { name: "Searching your foods" })).toBeNull();
    });
  });

  describe("loading Open Food Facts", () => {
    beforeEach(() => {
      Object.assign(searchResult, { local: [ownHit], isLoadingOff: true });
    });

    it("should say it is searching Open Food Facts below the local results, which stay in full view", async () => {
      await renderSearch();

      expect(screen.getByRole("status", { name: "Searching Open Food Facts" })).toBeOnTheScreen();
      expect(screen.queryByRole("status", { name: "Searching your foods" })).toBeNull();
      expect(screen.getByRole("button", { name: ownRowName })).toBeOnTheScreen();
      expect(screen.getByLabelText("Search results")).not.toHaveStyle({ opacity: 0.5 });
    });

    it("should not say nothing was found while Open Food Facts is still being searched", async () => {
      Object.assign(searchResult, { local: [] });

      await renderSearch();

      expect(screen.queryByRole("heading", { name: "No foods found" })).not.toBeOnTheScreen();
    });
  });

  describe("the Open Food Facts group", () => {
    it("should not appear when there are no candidates", async () => {
      Object.assign(searchResult, { local: [ownHit] });

      await renderSearch();

      expect(
        screen.queryByRole("heading", { name: /^From Open Food Facts/ }),
      ).not.toBeOnTheScreen();
    });

    it("should come last, under its own heading, when there are candidates", async () => {
      Object.assign(searchResult, { local: [ownHit], off: [offCandidateFixture] });

      await renderSearch();

      expect(
        screen.getByRole("heading", { name: "From Open Food Facts · Live results" }),
      ).toBeOnTheScreen();
      expect(
        screen.getByRole("button", {
          name: "Oat drink, Oatly, protein 1 gram, fat 1.5 grams, carbohydrate 6.7 grams, 46 kcal",
        }),
      ).toBeOnTheScreen();
    });

    it("should keep the candidates out of the local groups", async () => {
      Object.assign(searchResult, { local: [ownHit], off: [offCandidateFixture] });

      await renderSearch();

      expect(screen.getByLabelText("Your foods")).not.toHaveTextContent("Oat drink");
      expect(
        within(screen.getByLabelText("From Open Food Facts")).getAllByRole("button"),
      ).toHaveLength(1);
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

    it("should hold back a second press that lands before the first has settled", async () => {
      Object.assign(searchResult, { off: [offCandidateFixture] });
      mockMaterialiseOffProduct.mockReturnValue(new Promise(() => undefined));
      await renderSearch();
      const row = screen.getByRole("button", { name: /^Oat drink/ });

      // Both presses arrive in one batch, before the row has been redrawn as busy.
      // The pressable's click handler is what a screen reader's tap or a fast double tap reaches. A host
      // node's props are loosely typed, so the handler is given its shape here.
      const click = row.props.onClick as (event: { stopPropagation: () => void }) => void;
      await act(() => {
        click({ stopPropagation: () => undefined });
        click({ stopPropagation: () => undefined });
      });

      expect(mockMaterialiseOffProduct).toHaveBeenCalledTimes(1);
    });

    it("should ignore a further tap after a successful add, while the food opens", async () => {
      Object.assign(searchResult, { off: [offCandidateFixture] });
      mockMaterialiseOffProduct.mockResolvedValue(materialisedFood);
      const user = await renderSearch();
      await user.press(screen.getByRole("button", { name: /^Oat drink/ }));

      await user.press(screen.getByRole("button", { name: /^Oat drink/ }));

      expect(mockMaterialiseOffProduct).toHaveBeenCalledTimes(1);
      expect(routerMock.push).toHaveBeenCalledTimes(1);
    });

    it("should allow adding again once the user comes back to the sheet", async () => {
      Object.assign(searchResult, { off: [offCandidateFixture] });
      mockMaterialiseOffProduct.mockResolvedValue(materialisedFood);
      const user = await renderSearch();
      await user.press(screen.getByRole("button", { name: /^Oat drink/ }));

      // The food opens over the sheet, which loses focus, and coming back gives it focus again.
      routerMock.isFocused = false;
      await screen.rerender(sheet());
      routerMock.isFocused = true;
      await screen.rerender(sheet());
      await user.press(screen.getByRole("button", { name: /^Oat drink/ }));

      expect(mockMaterialiseOffProduct).toHaveBeenCalledTimes(2);
    });

    it("should allow another add once the first has failed", async () => {
      Object.assign(searchResult, { off: [offCandidateFixture] });
      mockMaterialiseOffProduct.mockRejectedValueOnce(new Error("network down"));
      mockMaterialiseOffProduct.mockResolvedValueOnce(materialisedFood);
      const user = await renderSearch();
      await user.press(screen.getByRole("button", { name: /^Oat drink/ }));
      await screen.findByRole("alert");

      await user.press(screen.getByRole("button", { name: /^Oat drink/ }));

      expect(mockMaterialiseOffProduct).toHaveBeenCalledTimes(2);
      expect(routerMock.push).toHaveBeenCalledWith(`/foods/${materialisedFoodId}`);
    });
  });

  describe("adding a product", () => {
    beforeEach(() => {
      Object.assign(searchResult, {
        local: [ownHit],
        off: [
          offCandidateFixture,
          { ...offCandidateFixture, code: "4006381333931", name: "Soya drink" },
        ],
      });
      mockMaterialiseOffProduct.mockReturnValue(new Promise(() => undefined));
    });

    it("should say the product is being added and dim the other candidates", async () => {
      const user = await renderSearch();

      await user.press(screen.getByRole("button", { name: /^Oat drink/ }));

      const addingRow = screen.getByRole("button", { name: /^Oat drink/, busy: true });
      expect(within(addingRow).getByText("Adding to your foods")).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: /^Soya drink/ })).toBeDisabled();
      expect(screen.getByRole("button", { name: /^Soya drink/ })).toHaveStyle({ opacity: 0.5 });
      expect(addingRow).not.toHaveStyle({ opacity: 0.5 });
    });

    it("should ignore a press on another candidate while one is being added", async () => {
      const user = await renderSearch();
      await user.press(screen.getByRole("button", { name: /^Oat drink/ }));

      await user.press(screen.getByRole("button", { name: /^Soya drink/ }));

      expect(mockMaterialiseOffProduct).toHaveBeenCalledTimes(1);
      expect(routerMock.push).not.toHaveBeenCalled();
    });

    it("should leave the local results alone", async () => {
      const user = await renderSearch();

      await user.press(screen.getByRole("button", { name: /^Oat drink/ }));

      expect(screen.getByRole("button", { name: ownRowName })).toBeEnabled();
    });
  });

  describe("when adding a product fails", () => {
    beforeEach(() => {
      Object.assign(searchResult, { off: [offCandidateFixture] });
    });

    async function failToAdd(error: unknown) {
      mockMaterialiseOffProduct.mockRejectedValue(error);
      const user = await renderSearch();
      await user.press(screen.getByRole("button", { name: /^Oat drink/ }));
      return user;
    }

    it("should say so in the group, above the rows, and stay put", async () => {
      await failToAdd(new Error("socket hang up"));

      const alert = await screen.findByRole("alert", {
        name: "This product could not be added Check your connection and try again.",
      });
      // The banner is in the group's column, outside the card that holds the rows.
      const card = screen.getByLabelText("From Open Food Facts");
      expect(within(card).queryByRole("alert")).not.toBeOnTheScreen();
      expect(within(card.parent ?? card).getByRole("alert")).toBe(alert);
      expect(routerMock.push).not.toHaveBeenCalled();
      expect(screen.getByRole("button", { name: /^Oat drink/ })).toBeEnabled();
    });

    it("should never show the raw text of the failure", async () => {
      await failToAdd(new Error("socket hang up"));
      await screen.findByRole("alert");

      expect(screen.queryByText(/socket hang up/)).not.toBeOnTheScreen();
    });

    it("should say how long to wait when Open Food Facts is rate limited", async () => {
      await failToAdd(new RateLimitedError("slow down", 20, new Error("429")));

      expect(
        await screen.findByRole("alert", {
          name: "Open Food Facts is busy. Try again in 20 seconds.",
        }),
      ).toBeOnTheScreen();
    });

    it("should say one second in the singular", async () => {
      await failToAdd(new RateLimitedError("slow down", 1, new Error("429")));

      expect(
        await screen.findByRole("alert", {
          name: "Open Food Facts is busy. Try again in 1 second.",
        }),
      ).toBeOnTheScreen();
    });

    it("should say to try again in a moment when no time is known", async () => {
      await failToAdd(new RateLimitedError("slow down", undefined, new Error("429")));

      expect(
        await screen.findByRole("alert", {
          name: "Open Food Facts is busy. Try again in a moment.",
        }),
      ).toBeOnTheScreen();
    });

    it("should say when Open Food Facts no longer has the product, in the title alone", async () => {
      await failToAdd(new OffProductNotFoundError("5000168001234"));

      expect(
        await screen.findByRole("alert", { name: "Open Food Facts no longer has this product." }),
      ).toBeOnTheScreen();
    });

    it("should clear when the user changes the search", async () => {
      const user = await failToAdd(new Error("network down"));
      await screen.findByRole("alert");

      await user.type(field(), "s");

      expect(screen.queryByRole("alert")).not.toBeOnTheScreen();
    });

    it("should clear when the user tries again", async () => {
      const user = await failToAdd(new Error("network down"));
      await screen.findByRole("alert");
      mockMaterialiseOffProduct.mockResolvedValue(materialisedFood);

      await user.press(screen.getByRole("button", { name: /^Oat drink/ }));

      await waitFor(() => {
        expect(screen.queryByRole("alert")).not.toBeOnTheScreen();
      });
      expect(routerMock.push).toHaveBeenCalledWith(`/foods/${materialisedFoodId}`);
    });
  });

  describe("when Open Food Facts cannot be searched", () => {
    beforeEach(() => {
      Object.assign(searchResult, { local: [ownHit] });
    });

    it("should keep the local results and say so in a quiet notice that is not an alert", async () => {
      Object.assign(searchResult, { offError: { kind: "failed", debugMessage: "boom" } });

      await renderSearch();

      expect(
        screen.getByRole("status", {
          name: "Open Food Facts could not be searched right now Your own results still work. Change your search to try again.",
        }),
      ).toBeOnTheScreen();
      expect(screen.queryByRole("alert")).not.toBeOnTheScreen();
      expect(screen.getByRole("button", { name: ownRowName })).toBeOnTheScreen();
    });

    it("should never show the raw text of the failure", async () => {
      Object.assign(searchResult, {
        offError: { kind: "failed", debugMessage: "boom" },
      });

      await renderSearch();

      expect(screen.queryByText(/boom/)).not.toBeOnTheScreen();
    });

    it("should say how long to wait when rate limited, with no retry button", async () => {
      Object.assign(searchResult, { offError: { kind: "rate_limited", retryAfterSeconds: 30 } });

      await renderSearch();

      expect(
        screen.getByRole("status", { name: "Open Food Facts is busy. Try again in 30 seconds." }),
      ).toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: /try again|retry/i })).not.toBeOnTheScreen();
      expect(screen.getByRole("button", { name: ownRowName })).toBeOnTheScreen();
    });

    it("should say one second in the singular", async () => {
      Object.assign(searchResult, { offError: { kind: "rate_limited", retryAfterSeconds: 1 } });

      await renderSearch();

      expect(
        screen.getByRole("status", { name: "Open Food Facts is busy. Try again in 1 second." }),
      ).toBeOnTheScreen();
    });

    it("should still ask the user to wait when no delay is given", async () => {
      Object.assign(searchResult, { offError: { kind: "rate_limited" } });

      await renderSearch();

      expect(
        screen.getByRole("status", { name: "Open Food Facts is busy. Try again in a moment." }),
      ).toBeOnTheScreen();
    });
  });

  describe("when nothing matches", () => {
    it("should say no foods were found and offer to create one", async () => {
      await renderSearch("zzqx");

      expect(screen.getByRole("heading", { name: "No foods found" })).toBeOnTheScreen();
      expect(screen.getByText("Try other words, or create the food yourself.")).toBeOnTheScreen();
      expect(createButtons()).toHaveLength(2);
    });

    it("should open the new food screen from the empty state", async () => {
      const user = await renderSearch("zzqx");

      await user.press(emptyStateCreateButton());

      expect(routerMock.push).toHaveBeenCalledWith("/foods/new");
    });

    it("should say so above the empty state when Open Food Facts could not be searched", async () => {
      Object.assign(searchResult, { offError: { kind: "failed" } });

      await renderSearch("zzqx");

      expect(
        screen.getByRole("status", {
          name: "Open Food Facts could not be searched right now Your own results still work. Change your search to try again.",
        }),
      ).toBeOnTheScreen();
      expect(screen.getByRole("heading", { name: "No foods found" })).toBeOnTheScreen();
    });

    it("should not say so when Open Food Facts has candidates", async () => {
      Object.assign(searchResult, { off: [offCandidateFixture] });

      await renderSearch();

      expect(screen.queryByRole("heading", { name: "No foods found" })).not.toBeOnTheScreen();
    });

    it("should not say so while the search is still waiting to start", async () => {
      Object.assign(searchResult, { isDebouncing: true });

      await renderSearch("zzqx");

      expect(screen.queryByRole("heading", { name: "No foods found" })).not.toBeOnTheScreen();
    });
  });

  describe("when the local search fails", () => {
    beforeEach(() => {
      Object.assign(searchResult, { localError: { kind: "failed", debugMessage: "rpc failed" } });
    });

    it("should say so in an alert, with no retry button", async () => {
      await renderSearch();

      expect(
        screen.getByRole("alert", {
          name: "Your foods could not be searched Check your connection and try again.",
        }),
      ).toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: /try again|retry/i })).not.toBeOnTheScreen();
    });

    it("should not claim that no foods were found, nor show the raw text", async () => {
      await renderSearch();

      expect(screen.queryByRole("heading", { name: "No foods found" })).not.toBeOnTheScreen();
      expect(screen.queryByText(/rpc failed/)).not.toBeOnTheScreen();
    });
  });
});
