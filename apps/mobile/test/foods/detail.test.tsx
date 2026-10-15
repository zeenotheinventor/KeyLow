import { DATA_SOURCE_ATTRIBUTION } from "@keylow/core/foods";
import { buildFoodPortion } from "@keylow/core/testing";
import { render, screen, userEvent, within } from "@testing-library/react-native";

import {
  foodFixture,
  foodQuery,
  mockUseFoodWithPortions,
  portionFixtures,
  portionsQuery,
  resetApiClientMock,
  savedFoodId,
} from "./support/apiClientMock";
import FoodDetailRoute from "../../app/foods/[id]/index";
import { ThemeProvider } from "../../lib/theme";
import { resetRouterMock, routerMock } from "../support/expoRouterMock";

import type { Food, FoodPortion } from "@keylow/core/schemas";

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
jest.mock(
  "expo-router",
  () => jest.requireActual<{ mockExpoRouter: unknown }>("../support/expoRouterMock").mockExpoRouter,
);
jest.mock(
  "@keylow/api-client",
  () => jest.requireActual<{ mockApiClient: unknown }>("./support/apiClientMock").mockApiClient,
);

const offFood: Food = {
  ...foodFixture,
  source: "off",
  source_ref: "5012345678900",
  owner_id: null,
  name: "Crunchy granola",
  brand: "Nature's Best",
};
const suspectFood: Food = {
  ...offFood,
  protein_g: null,
  carbs_g: null,
  quality: { suspect: true, fields_missing: ["protein_g", "carbs_g"] },
};

function makePortion(overrides: Partial<FoodPortion>): FoodPortion {
  return buildFoodPortion({
    id: "88888888-8888-4888-8888-888888888888",
    food_id: savedFoodId,
    grams: null,
    created_at: "2026-10-07T09:00:00Z",
    ...overrides,
  });
}

function showFood(food: Food, portions: FoodPortion[] = portionFixtures) {
  Object.assign(foodQuery, { data: food });
  Object.assign(portionsQuery, { data: portions });
}

async function renderDetail() {
  const user = userEvent.setup();
  await render(
    <ThemeProvider fixedPreference="dark">
      <FoodDetailRoute />
    </ThemeProvider>,
  );
  return user;
}

// Every button on the screen, by accessible name, in the order they are drawn.
function expectButtons(names: string[]) {
  const buttons = screen.getAllByRole("button");
  expect(buttons).toHaveLength(names.length);
  names.forEach((name, index) => {
    expect(buttons[index]).toHaveAccessibleName(name);
  });
}

describe("food detail screen", () => {
  beforeEach(() => {
    resetRouterMock();
    resetApiClientMock();
    routerMock.searchParams = { id: savedFoodId };
  });

  it("should load the food and its portions by the id in the route", async () => {
    await renderDetail();

    expect(mockUseFoodWithPortions).toHaveBeenCalledWith(savedFoodId);
  });

  describe("an id that is not a food id", () => {
    beforeEach(() => {
      routerMock.searchParams = { id: "oat-bar" };
    });

    it("should say the food was not found, without asking for it", async () => {
      await renderDetail();

      expect(screen.getByRole("heading", { name: "Food not found" })).toBeOnTheScreen();
      expect(mockUseFoodWithPortions).not.toHaveBeenCalledWith("oat-bar");
    });
  });

  describe("the header", () => {
    it("should be titled Food, with Back and Close, and leave the heading to the food's name", async () => {
      await renderDetail();

      expect(screen.getByText("Food")).toBeOnTheScreen();
      expect(screen.queryByRole("heading", { name: "Food" })).not.toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Back" })).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Close" })).toBeOnTheScreen();
    });

    it("should go back to the screen before on Back", async () => {
      const user = await renderDetail();

      await user.press(screen.getByRole("button", { name: "Back" }));

      expect(routerMock.back).toHaveBeenCalledTimes(1);
    });

    it("should close the whole sheet on Close", async () => {
      const user = await renderDetail();

      await user.press(screen.getByRole("button", { name: "Close" }));

      expect(routerMock.parentGoBack).toHaveBeenCalledTimes(1);
    });

    it("should stay on screen while the food loads, fails to load and is not found", async () => {
      Object.assign(foodQuery, { data: undefined, isPending: true });
      await renderDetail();
      expect(screen.getByRole("button", { name: "Back" })).toBeOnTheScreen();
      await screen.unmount();

      Object.assign(foodQuery, { data: undefined, isPending: false, isError: true });
      await renderDetail();
      expect(screen.getByRole("button", { name: "Close" })).toBeOnTheScreen();
      await screen.unmount();

      Object.assign(foodQuery, { data: null, isError: false });
      await renderDetail();
      expect(screen.getByRole("button", { name: "Close" })).toBeOnTheScreen();
    });
  });

  describe("states", () => {
    it("should say it is loading while the food loads, and draw the skeleton of the page", async () => {
      Object.assign(foodQuery, { data: undefined, isPending: true });

      await renderDetail();

      expect(screen.getByRole("status", { name: "Loading food" })).toBeOnTheScreen();
      expect(screen.getByText("Loading food")).toBeOnTheScreen();
      expect(screen.getByTestId("skeleton-detail", { includeHiddenElements: true })).toBeTruthy();
      expect(screen.queryByRole("heading", { name: "Oat bar" })).not.toBeOnTheScreen();
    });

    it("should say it is loading while the portions load", async () => {
      Object.assign(portionsQuery, { data: undefined, isPending: true });

      await renderDetail();

      expect(screen.getByRole("status", { name: "Loading food" })).toBeOnTheScreen();
    });

    it("should show the fixed failed sentence when the food fails to load, never the failure", async () => {
      Object.assign(foodQuery, { data: undefined, isPending: false, isError: true });

      await renderDetail();

      const alert = screen.getByRole("alert");
      expect(within(alert).getByText("Food not loaded")).toBeOnTheScreen();
      expect(
        within(alert).getByText("The food could not be loaded. Try again later."),
      ).toBeOnTheScreen();
      expect(screen.queryByText(/query failed/)).not.toBeOnTheScreen();
    });

    it("should show the same sentence when the portions fail to load", async () => {
      Object.assign(portionsQuery, { data: undefined, isPending: false, isError: true });

      await renderDetail();

      expect(within(screen.getByRole("alert")).getByText("Food not loaded")).toBeOnTheScreen();
      expect(screen.queryByText(/query failed/)).not.toBeOnTheScreen();
    });

    it("should keep showing the food when a later refresh of the food fails", async () => {
      Object.assign(foodQuery, { isError: true });

      await renderDetail();

      expect(screen.getByRole("heading", { name: "Oat bar" })).toBeOnTheScreen();
      expect(screen.queryByRole("alert")).not.toBeOnTheScreen();
    });

    it("should keep showing the food when a later refresh of the portions fails", async () => {
      Object.assign(portionsQuery, { isError: true });

      await renderDetail();

      expect(screen.getByRole("heading", { name: "Oat bar" })).toBeOnTheScreen();
      expect(screen.getByLabelText("1 bar, 45 g, Default")).toBeOnTheScreen();
      expect(screen.queryByRole("alert")).not.toBeOnTheScreen();
    });

    it("should say the food was not found when it is not visible", async () => {
      Object.assign(foodQuery, { data: null });

      await renderDetail();

      expect(screen.getByRole("heading", { name: "Food not found" })).toBeOnTheScreen();
      expect(screen.getByText("This food does not exist, or you cannot see it.")).toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: "Edit" })).not.toBeOnTheScreen();
    });
  });

  describe("the food", () => {
    it("should show the name as the heading, with the source and the brand", async () => {
      showFood(offFood);

      await renderDetail();

      expect(screen.getByRole("heading", { name: "Crunchy granola" })).toBeOnTheScreen();
      expect(screen.getByText("Open Food Facts")).toBeOnTheScreen();
      expect(screen.getByText("Nature's Best")).toBeOnTheScreen();
    });

    it("should leave the brand out when there is none", async () => {
      showFood({ ...foodFixture, brand: null });

      await renderDetail();

      expect(screen.queryByText("Acme")).not.toBeOnTheScreen();
    });

    it.each([
      ["off", "Open Food Facts"],
      ["cofid", "UK CoFID"],
      ["user", "Yours"],
    ] as const)("should name %s as %s", async (source, expected) => {
      showFood({
        ...foodFixture,
        source,
        owner_id: source === "user" ? foodFixture.owner_id : null,
      });

      await renderDetail();

      expect(screen.getByText(expected)).toBeOnTheScreen();
    });
  });

  describe("the energy card", () => {
    function energyCard(basis = "per 100 g") {
      return within(screen.getByLabelText(`Energy and macros, ${basis}`));
    }

    it("should show the energy as a numeral in kcal, with the basis written out", async () => {
      await renderDetail();

      expect(energyCard().getByText("420")).toBeOnTheScreen();
      expect(energyCard().getByText("kcal")).toBeOnTheScreen();
      expect(energyCard().getByText("per 100 g")).toBeOnTheScreen();
    });

    it("should group the thousands of the energy", async () => {
      showFood({ ...foodFixture, kcal: 1234 });

      await renderDetail();

      expect(energyCard().getByText("1,234")).toBeOnTheScreen();
    });

    it("should say per 100 ml for a liquid", async () => {
      showFood({ ...foodFixture, basis: "per_100ml" });

      await renderDetail();

      expect(energyCard("per 100 ml").getByText("per 100 ml")).toBeOnTheScreen();
    });

    it("should show protein, carbohydrate and fat with their share of the energy", async () => {
      await renderDetail();

      expect(screen.getByLabelText("Protein, 8.5 g, 8 % of energy")).toBeOnTheScreen();
      expect(screen.getByLabelText("Carbs, 62 g, 59 % of energy")).toBeOnTheScreen();
      expect(screen.getByLabelText("Fat, 14 g, 30 % of energy")).toBeOnTheScreen();
      expect(energyCard().getByText("8 %")).toBeOnTheScreen();
      expect(energyCard().getByText("59 %")).toBeOnTheScreen();
      expect(energyCard().getByText("30 %")).toBeOnTheScreen();
    });

    it("should caption the shares as estimates", async () => {
      await renderDetail();

      expect(energyCard().getByText("Shares of energy are estimates")).toBeOnTheScreen();
    });

    it("should say not given for a missing macro and draw no share for it", async () => {
      showFood({ ...foodFixture, protein_g: null });

      await renderDetail();

      expect(screen.getByLabelText("Protein, not given")).toBeOnTheScreen();
      expect(
        within(screen.getByLabelText("Protein, not given")).getByText("not given"),
      ).toBeOnTheScreen();
      expect(screen.getByLabelText("Carbs, 62 g, 59 % of energy")).toBeOnTheScreen();
    });

    it("should show a real zero as zero with its share, not as not given", async () => {
      showFood({ ...foodFixture, carbs_g: 0 });

      await renderDetail();

      expect(screen.getByLabelText("Carbs, 0 g, 0 % of energy")).toBeOnTheScreen();
    });

    it("should leave the caption out when energy is 0, because no share is drawn", async () => {
      showFood({ ...foodFixture, kcal: 0 });

      await renderDetail();

      expect(energyCard().queryByText(/ %$/)).not.toBeOnTheScreen();
      expect(energyCard().queryByText("Shares of energy are estimates")).not.toBeOnTheScreen();
    });

    it("should leave the caption out when every macro is missing, because no share is drawn", async () => {
      showFood({ ...foodFixture, protein_g: null, carbs_g: null, fat_g: null });

      await renderDetail();

      expect(energyCard().getByText("420")).toBeOnTheScreen();
      expect(energyCard().queryByText("Shares of energy are estimates")).not.toBeOnTheScreen();
    });

    it("should say energy is not given, and invent no share and no caption, without it", async () => {
      showFood({ ...foodFixture, kcal: null });

      await renderDetail();

      expect(energyCard().getByText("Energy not given")).toBeOnTheScreen();
      expect(energyCard().queryByText("kcal")).not.toBeOnTheScreen();
      expect(screen.getByLabelText("Protein, 8.5 g")).toBeOnTheScreen();
      expect(energyCard().queryByText(/ %$/)).not.toBeOnTheScreen();
      expect(energyCard().queryByText("Shares of energy are estimates")).not.toBeOnTheScreen();
    });
  });

  describe("the nutrition table", () => {
    it("should list energy, protein, carbohydrate, fat and fibre in that order, per 100 g", async () => {
      await renderDetail();

      expect(screen.getByRole("heading", { name: "Nutrition per 100 g" })).toBeOnTheScreen();
      const rows = within(screen.getByLabelText("Nutrition per 100 g")).getAllByLabelText(/: /);
      const expected = [
        "Energy: 420 kcal",
        "Protein: 8.5 g",
        "Carbohydrate: 62 g",
        "Fat: 14 g",
        "Fibre: 6.5 g",
      ];
      expect(rows).toHaveLength(expected.length);
      expected.forEach((label, index) => {
        expect(rows[index]).toHaveAccessibleName(label);
      });
    });

    it("should say per 100 ml for a liquid", async () => {
      showFood({ ...foodFixture, basis: "per_100ml" });

      await renderDetail();

      expect(screen.getByRole("heading", { name: "Nutrition per 100 ml" })).toBeOnTheScreen();
    });

    it("should say not given for a missing value, never zero", async () => {
      showFood({ ...foodFixture, fibre_g: null, fat_g: null });

      await renderDetail();

      expect(screen.getByLabelText("Fibre: not given")).toBeOnTheScreen();
      expect(screen.getByLabelText("Fat: not given")).toBeOnTheScreen();
      expect(screen.queryByLabelText(/Fibre: 0/)).not.toBeOnTheScreen();
    });

    it("should show a real zero as zero grams, as a CoFID trace is", async () => {
      showFood({ ...foodFixture, fibre_g: 0 });

      await renderDetail();

      expect(screen.getByLabelText("Fibre: 0 g")).toBeOnTheScreen();
    });

    it("should write a value under 10 with one decimal and any other as a whole number", async () => {
      showFood({ ...foodFixture, protein_g: 8.46, fat_g: 14.4 });

      await renderDetail();

      expect(screen.getByLabelText("Protein: 8.5 g")).toBeOnTheScreen();
      expect(screen.getByLabelText("Fat: 14 g")).toBeOnTheScreen();
    });
  });

  describe("the carbohydrate convention", () => {
    const note = "Carbohydrate includes fibre (US labelling convention).";

    it("should explain a US total carbohydrate", async () => {
      showFood({ ...offFood, quality: { carbs_convention: "us_total" } });

      await renderDetail();

      expect(screen.getByText(note)).toBeOnTheScreen();
    });

    it.each([{ carbs_convention: "eu" as const }, {}])(
      "should show no note for quality %j",
      async (quality) => {
        showFood({ ...offFood, quality });

        await renderDetail();

        expect(screen.queryByText(note)).not.toBeOnTheScreen();
      },
    );
  });

  describe("the lists", () => {
    it("should give each nutrient row the list item role, inside the nutrition list", async () => {
      await renderDetail();

      const list = within(screen.getByLabelText("Nutrition per 100 g"));
      expect(list.getAllByRole("listitem")).toHaveLength(5);
    });

    it("should give each portion the list item role, inside the portions list", async () => {
      await renderDetail();

      const list = within(screen.getByLabelText("Portions"));
      expect(list.getAllByRole("listitem")).toHaveLength(2);
    });
  });

  describe("portions", () => {
    it("should list each portion with its amount and mark the default", async () => {
      await renderDetail();

      expect(screen.getByRole("heading", { name: "Portions" })).toBeOnTheScreen();
      expect(screen.getByLabelText("Portions")).toBeOnTheScreen();
      expect(screen.getByLabelText("1 bar, 45 g, Default")).toBeOnTheScreen();
      expect(screen.getByLabelText("Box of 6, 270 g")).toBeOnTheScreen();
      expect(
        within(screen.getByLabelText("1 bar, 45 g, Default")).getByText("Default"),
      ).toBeOnTheScreen();
      expect(
        within(screen.getByLabelText("Box of 6, 270 g")).queryByText("Default"),
      ).not.toBeOnTheScreen();
    });

    it("should show a portion given in millilitres with its unit", async () => {
      showFood({ ...foodFixture, basis: "per_100ml" }, [
        makePortion({ label: "1 glass", ml: 250, is_default: true }),
      ]);

      await renderDetail();

      expect(screen.getByLabelText("1 glass, 250 ml, Default")).toBeOnTheScreen();
    });

    it("should leave the portions out when there are none", async () => {
      showFood(foodFixture, []);

      await renderDetail();

      expect(screen.queryByRole("heading", { name: "Portions" })).not.toBeOnTheScreen();
      expect(screen.queryByLabelText("Portions")).not.toBeOnTheScreen();
    });
  });

  describe("the data source credit", () => {
    it.each(["off", "cofid"] as const)(
      "should not draw the licence credit for a %s food, which is on the About screen",
      async (source) => {
        showFood({ ...offFood, source });

        await renderDetail();

        expect(screen.queryByText(DATA_SOURCE_ATTRIBUTION.off.text)).not.toBeOnTheScreen();
        expect(screen.queryByText(DATA_SOURCE_ATTRIBUTION.cofid.text)).not.toBeOnTheScreen();
        expect(screen.queryByRole("link")).not.toBeOnTheScreen();
      },
    );

    it("should keep the source badge under the name", async () => {
      showFood(offFood);

      await renderDetail();

      expect(screen.getByText("Open Food Facts")).toBeOnTheScreen();
    });
  });

  describe("the Edit action", () => {
    it("should open the editor for the user's own food", async () => {
      const user = await renderDetail();

      await user.press(screen.getByRole("button", { name: "Edit" }));

      expect(routerMock.push).toHaveBeenCalledTimes(1);
      expect(routerMock.push).toHaveBeenCalledWith(`/foods/${savedFoodId}/edit`);
    });

    it.each(["off", "cofid"] as const)("should not be offered for a %s food", async (source) => {
      showFood({ ...foodFixture, source, owner_id: null });

      await renderDetail();

      expect(screen.queryByRole("button", { name: "Edit" })).not.toBeOnTheScreen();
    });
  });

  describe("a food that is not suspect", () => {
    it("should offer no action for a shared food, and no notice", async () => {
      showFood(offFood);

      await renderDetail();

      expectButtons(["Back", "Close"]);
      expect(screen.queryByText("Needs review")).not.toBeOnTheScreen();
    });
  });

  describe("a suspect food", () => {
    beforeEach(() => {
      showFood(suspectFood);
    });

    it("should say Needs review and name the missing values in one sentence", async () => {
      await renderDetail();

      const notice = screen.getByRole("note");
      expect(within(notice).getByText("Needs review")).toBeOnTheScreen();
      expect(
        within(notice).getByText(
          "Protein and carbohydrate are not given. Fill them in to save your own copy of this food.",
        ),
      ).toBeOnTheScreen();
    });

    it("should still show the values it has and say not given for the rest", async () => {
      await renderDetail();

      expect(screen.getByLabelText("Energy: 420 kcal")).toBeOnTheScreen();
      expect(screen.getByLabelText("Protein: not given")).toBeOnTheScreen();
      expect(screen.getByLabelText("Carbohydrate: not given")).toBeOnTheScreen();
    });

    it("should offer exactly one action, Copy to your foods, which opens the copy form", async () => {
      const user = await renderDetail();

      await user.press(screen.getByRole("button", { name: "Copy to your foods" }));

      expect(routerMock.push).toHaveBeenCalledTimes(1);
      expect(routerMock.push).toHaveBeenCalledWith(`/foods/new?from=${savedFoodId}`);
      expect(screen.queryByRole("button", { name: /Review and save/ })).not.toBeOnTheScreen();
      expectButtons(["Back", "Close", "Copy to your foods"]);
    });

    it("should say carbohydrate still includes fibre when only the fibre of a US label is missing", async () => {
      showFood({
        ...suspectFood,
        protein_g: 8,
        carbs_g: 80,
        fibre_g: null,
        quality: { suspect: true, fields_missing: ["fibre_g"], carbs_convention: "us_total" },
      });

      await renderDetail();

      expect(
        screen.getByText(
          "Fibre is not given, so carbohydrate still includes it. Fill it in to save your own copy of this food.",
        ),
      ).toBeOnTheScreen();
      expect(
        screen.getByText("Carbohydrate includes fibre (US labelling convention)."),
      ).toBeOnTheScreen();
    });

    it("should still show the notice and its action when no field is listed", async () => {
      showFood({ ...suspectFood, quality: { suspect: true } });

      await renderDetail();

      expect(
        screen.getByText(
          "Some values are not given. Fill them in to save your own copy of this food.",
        ),
      ).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Copy to your foods" })).toBeOnTheScreen();
    });
  });
});
