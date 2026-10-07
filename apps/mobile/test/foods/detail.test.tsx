import { DATA_SOURCE_ATTRIBUTION } from "@keylow/core/foods";
import { render, screen, userEvent, within } from "@testing-library/react-native";

import {
  foodFixture,
  foodQuery,
  mockUseFood,
  mockUseFoodPortions,
  portionFixtures,
  portionsQuery,
  resetApiClientMock,
  savedFoodId,
} from "./support/apiClientMock";
import FoodDetailRoute from "../../app/foods/[id]/index";
import { resetRouterMock, routerMock } from "../support/expoRouterMock";

import type { Food, FoodPortion } from "@keylow/core/schemas";

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
  return {
    id: "88888888-8888-4888-8888-888888888888",
    food_id: savedFoodId,
    owner_id: null,
    label: "Portion",
    grams: null,
    ml: null,
    is_default: false,
    position: 0,
    created_at: "2026-10-07T09:00:00Z",
    ...overrides,
  };
}

function showFood(food: Food, portions: FoodPortion[] = portionFixtures) {
  Object.assign(foodQuery, { data: food });
  Object.assign(portionsQuery, { data: portions });
}

async function renderDetail() {
  const user = userEvent.setup();
  await render(<FoodDetailRoute />);
  return user;
}

describe("food detail screen", () => {
  beforeEach(() => {
    resetRouterMock();
    resetApiClientMock();
    routerMock.searchParams = { id: savedFoodId };
  });

  it("should load the food and its portions by the id in the route", async () => {
    await renderDetail();

    expect(mockUseFood).toHaveBeenCalledWith(savedFoodId);
    expect(mockUseFoodPortions).toHaveBeenCalledWith(savedFoodId);
  });

  describe("states", () => {
    it("should show a loading message while the food loads", async () => {
      Object.assign(foodQuery, { data: undefined, isPending: true });

      await renderDetail();

      expect(screen.getByText("Loading food")).toBeOnTheScreen();
      expect(screen.queryByRole("header", { name: "Oat bar" })).not.toBeOnTheScreen();
    });

    it("should show a loading message while the portions load", async () => {
      Object.assign(portionsQuery, { data: undefined, isPending: true });

      await renderDetail();

      expect(screen.getByText("Loading food")).toBeOnTheScreen();
    });

    it("should show an alert when the food fails to load", async () => {
      Object.assign(foodQuery, { data: undefined, isPending: false, isError: true });

      await renderDetail();

      expect(
        screen.getByRole("alert", { name: "The food could not be loaded. Try again later." }),
      ).toBeOnTheScreen();
    });

    it("should show an alert when the portions fail to load", async () => {
      Object.assign(portionsQuery, { data: undefined, isPending: false, isError: true });

      await renderDetail();

      expect(
        screen.getByRole("alert", { name: "The food could not be loaded. Try again later." }),
      ).toBeOnTheScreen();
    });

    it("should keep showing the food when a later refresh of the food fails", async () => {
      Object.assign(foodQuery, { isError: true });

      await renderDetail();

      expect(screen.getByRole("header", { name: "Oat bar" })).toBeOnTheScreen();
      expect(screen.queryByRole("alert")).not.toBeOnTheScreen();
    });

    it("should keep showing the food when a later refresh of the portions fails", async () => {
      Object.assign(portionsQuery, { isError: true });

      await renderDetail();

      expect(screen.getByRole("header", { name: "Oat bar" })).toBeOnTheScreen();
      expect(screen.getByLabelText("1 bar, 45 g, default")).toBeOnTheScreen();
      expect(screen.queryByRole("alert")).not.toBeOnTheScreen();
    });

    it("should say the food was not found when it is not visible", async () => {
      Object.assign(foodQuery, { data: null });

      await renderDetail();

      expect(screen.getByRole("header", { name: "Food not found" })).toBeOnTheScreen();
      expect(screen.queryByRole("button")).not.toBeOnTheScreen();
    });
  });

  describe("the food", () => {
    it("should show the name as the heading with the brand and the source", async () => {
      await renderDetail();

      expect(screen.getByRole("header", { name: "Oat bar" })).toBeOnTheScreen();
      expect(screen.getByText("Acme")).toBeOnTheScreen();
      expect(screen.getByText("Source: Own food")).toBeOnTheScreen();
    });

    it("should leave the brand out when there is none", async () => {
      showFood({ ...foodFixture, brand: null });

      await renderDetail();

      expect(screen.queryByText("Acme")).not.toBeOnTheScreen();
    });

    it.each([
      ["off", "Source: Open Food Facts"],
      ["cofid", "Source: CoFID"],
    ] as const)("should name %s as the source", async (source, expected) => {
      showFood({ ...foodFixture, source, owner_id: null });

      await renderDetail();

      expect(screen.getByText(expected)).toBeOnTheScreen();
    });
  });

  describe("nutrients", () => {
    it("should show the energy, the four macros and fibre per 100 g", async () => {
      await renderDetail();

      expect(screen.getByRole("header", { name: "Nutrition per 100 g" })).toBeOnTheScreen();
      expect(screen.getByLabelText("Energy: 420 kcal")).toBeOnTheScreen();
      expect(screen.getByLabelText("Protein: 8.5 g")).toBeOnTheScreen();
      expect(screen.getByLabelText("Fat: 14 g")).toBeOnTheScreen();
      expect(screen.getByLabelText("Carbohydrate: 62 g")).toBeOnTheScreen();
      expect(screen.getByLabelText("Fibre: 6.5 g")).toBeOnTheScreen();
    });

    it("should say per 100 ml for a liquid", async () => {
      showFood({ ...foodFixture, basis: "per_100ml" });

      await renderDetail();

      expect(screen.getByRole("header", { name: "Nutrition per 100 ml" })).toBeOnTheScreen();
    });

    it("should say not given for a missing value, never zero", async () => {
      showFood({ ...foodFixture, fibre_g: null, fat_g: null });

      await renderDetail();

      expect(screen.getByLabelText("Fibre: not given")).toBeOnTheScreen();
      expect(screen.getByLabelText("Fat: not given")).toBeOnTheScreen();
      expect(screen.queryByLabelText(/Fibre: 0/)).not.toBeOnTheScreen();
    });

    it("should show a real zero as zero", async () => {
      showFood({ ...foodFixture, fat_g: 0 });

      await renderDetail();

      expect(screen.getByLabelText("Fat: 0 g")).toBeOnTheScreen();
    });

    it("should round to one decimal place", async () => {
      showFood({ ...foodFixture, protein_g: 8.46 });

      await renderDetail();

      expect(screen.getByLabelText("Protein: 8.5 g")).toBeOnTheScreen();
    });
  });

  describe("portions", () => {
    it("should list each portion with its amount and mark the default", async () => {
      await renderDetail();

      expect(screen.getByRole("header", { name: "Portions" })).toBeOnTheScreen();
      expect(screen.getByLabelText("Portion sizes")).toBeOnTheScreen();
      expect(screen.getByLabelText("1 bar, 45 g, default")).toBeOnTheScreen();
      expect(screen.getByLabelText("Box of 6, 270 g")).toBeOnTheScreen();
    });

    it("should show a portion given in millilitres with its unit", async () => {
      showFood({ ...foodFixture, basis: "per_100ml" }, [
        makePortion({ label: "1 glass", ml: 250, is_default: true }),
      ]);

      await renderDetail();

      expect(screen.getByLabelText("1 glass, 250 ml, default")).toBeOnTheScreen();
    });

    it("should leave the portions section out when there are none", async () => {
      showFood(foodFixture, []);

      await renderDetail();

      expect(screen.queryByRole("header", { name: "Portions" })).not.toBeOnTheScreen();
      expect(screen.queryByLabelText("Portion sizes")).not.toBeOnTheScreen();
    });
  });

  describe("attribution", () => {
    it("should credit Open Food Facts for one of its foods", async () => {
      showFood(offFood);

      await renderDetail();

      expect(screen.getByText(DATA_SOURCE_ATTRIBUTION.off.text)).toBeOnTheScreen();
      expect(screen.getByText(DATA_SOURCE_ATTRIBUTION.off.url)).toBeOnTheScreen();
    });

    it("should credit the CoFID dataset for one of its foods", async () => {
      showFood({ ...offFood, source: "cofid" });

      await renderDetail();

      expect(screen.getByText(DATA_SOURCE_ATTRIBUTION.cofid.text)).toBeOnTheScreen();
      expect(screen.queryByText(DATA_SOURCE_ATTRIBUTION.off.text)).not.toBeOnTheScreen();
    });

    it("should show no credit for the user's own food", async () => {
      await renderDetail();

      expect(screen.queryByText(DATA_SOURCE_ATTRIBUTION.off.text)).not.toBeOnTheScreen();
      expect(screen.queryByText(DATA_SOURCE_ATTRIBUTION.cofid.text)).not.toBeOnTheScreen();
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
    it("should offer no action at all for a shared food, and no way to use it", async () => {
      showFood(offFood);

      await renderDetail();

      expect(screen.queryAllByRole("button")).toHaveLength(0);
      expect(screen.queryByText("Some values are missing")).not.toBeOnTheScreen();
    });
  });

  describe("a suspect food", () => {
    beforeEach(() => {
      showFood(suspectFood);
    });

    it("should say which values are missing, in plain words", async () => {
      await renderDetail();

      expect(screen.getByRole("header", { name: "Some values are missing" })).toBeOnTheScreen();
      const missing = within(screen.getByLabelText("Missing values"));
      expect(missing.getByText("Protein")).toBeOnTheScreen();
      expect(missing.getByText("Carbohydrate")).toBeOnTheScreen();
      expect(missing.queryByText("Fat")).not.toBeOnTheScreen();
    });

    it("should still show the values it has and say not given for the rest", async () => {
      await renderDetail();

      expect(screen.getByLabelText("Energy: 420 kcal")).toBeOnTheScreen();
      expect(screen.getByLabelText("Protein: not given")).toBeOnTheScreen();
      expect(screen.getByLabelText("Carbohydrate: not given")).toBeOnTheScreen();
    });

    it("should offer to review the food and save it as the user's own", async () => {
      const user = await renderDetail();

      await user.press(screen.getByRole("button", { name: "Review and save as my food" }));

      expect(routerMock.push).toHaveBeenCalledTimes(1);
      expect(routerMock.push).toHaveBeenCalledWith(`/foods/new?from=${savedFoodId}`);
    });

    it("should offer nothing else to do with the food", async () => {
      await renderDetail();

      const buttons = screen.getAllByRole("button");
      expect(buttons).toHaveLength(1);
      expect(buttons[0]).toHaveAccessibleName("Review and save as my food");
    });

    it("should name a field it has no words for as it is stored, without underscores", async () => {
      showFood({ ...suspectFood, quality: { suspect: true, fields_missing: ["zinc_mg"] } });

      await renderDetail();

      expect(
        within(screen.getByLabelText("Missing values")).getByText("zinc mg"),
      ).toBeOnTheScreen();
    });

    it("should still show the review action when no field is listed", async () => {
      showFood({ ...suspectFood, quality: { suspect: true } });

      await renderDetail();

      expect(screen.getByRole("header", { name: "Some values are missing" })).toBeOnTheScreen();
      expect(screen.queryByLabelText("Missing values")).not.toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Review and save as my food" })).toBeOnTheScreen();
    });
  });
});
