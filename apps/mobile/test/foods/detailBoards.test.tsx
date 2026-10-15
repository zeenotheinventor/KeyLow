import { themes } from "@keylow/tokens";
import { render, screen, within } from "@testing-library/react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  foodFixture,
  foodQuery,
  portionsQuery,
  resetApiClientMock,
  savedFoodId,
} from "./support/apiClientMock";
import FoodDetailRoute from "../../app/foods/[id]/index";
import { ThemeProvider } from "../../lib/theme";
import { resetRouterMock, routerMock } from "../support/expoRouterMock";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { resolvedColor } from "../support/themeColor";
import { viewsDrawn } from "../support/viewsDrawn";

import type { Food } from "@keylow/core/schemas";
import type { ThemeScheme } from "@keylow/tokens";

// The food detail boards, in dark and light, on the real route: the values the boards give for the
// hero card, the macro tiles, the nutrition table, the portions and the notice.
// What the screen does is in detail.test.tsx.

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
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

const schemes: ThemeScheme[] = ["dark", "light"];

// The "Honey Oat Rings" of the missing-values-us-carbs board: a shared food whose fibre is not given.
const ringsFood: Food = {
  ...foodFixture,
  source: "off",
  owner_id: null,
  name: "Honey Oat Rings",
  brand: "Northfield Mills",
  kcal: 375,
  protein_g: 8,
  carbs_g: 80,
  fat_g: 4.5,
  fibre_g: null,
  quality: { suspect: true, fields_missing: ["fibre_g"], carbs_convention: "us_total" },
};

async function renderDetail(scheme: ThemeScheme, food: Food = foodFixture) {
  Object.assign(foodQuery, { data: food });
  await render(
    <ThemeProvider fixedPreference={scheme}>
      <FoodDetailRoute />
    </ThemeProvider>,
  );
}

describe("food detail boards", () => {
  let styles: string;

  beforeAll(async () => {
    styles = await compileKitStyles("", [
      "components/FoodDetail",
      "components/NutrientTable",
      "components/FoodLoadState",
      "components/FoodFormScreen",
    ]);
  });

  beforeEach(() => {
    jest.mocked(useSafeAreaInsets).mockReturnValue({ top: 0, right: 0, bottom: 0, left: 0 });
    registerAppStyles(styles);
    resetRouterMock();
    resetApiClientMock();
    routerMock.searchParams = { id: savedFoodId };
  });

  describe.each(schemes)("in the %s scheme", (scheme) => {
    const colorOf = (name: Parameters<typeof resolvedColor>[1]) => resolvedColor(scheme, name);

    it("should set the name as the h1: 28 over 34 in the primary text colour", async () => {
      await renderDetail(scheme);

      expect(screen.getByRole("heading", { name: "Oat bar" })).toHaveStyle({
        fontFamily: "Geist-SemiBold",
        fontSize: 28,
        lineHeight: 34,
        color: colorOf("text-primary"),
      });
    });

    it("should put the content 16 in from the sides with 16 between its blocks and 34 below", async () => {
      await renderDetail(scheme);

      const scrollView = screen.root?.queryAll((node) => node.type === "RCTScrollView")[0];

      expect(scrollView?.props.contentContainerStyle).toMatchObject({
        rowGap: 16,
        paddingLeft: 16,
        paddingRight: 16,
        paddingTop: 4,
        paddingBottom: 34,
      });
    });

    it("should keep the content off a navigation bar taller than the board's 34 below it", async () => {
      jest.mocked(useSafeAreaInsets).mockReturnValue({ top: 0, right: 0, bottom: 48, left: 0 });
      await renderDetail(scheme);

      const scrollView = screen.root?.queryAll((node) => node.type === "RCTScrollView")[0];
      expect(scrollView?.props.contentContainerStyle).toMatchObject({ paddingBottom: 48 });
    });

    it("should centre the source badge on its line with the brand", async () => {
      Object.assign(portionsQuery, { data: [] });
      await renderDetail(scheme);

      expect(viewsDrawn({ alignSelf: "center" })).toHaveLength(1);
    });

    it("should centre the Default badge on its line with the portion's name", async () => {
      await renderDetail(scheme);

      // The source badge's wrapper, and the one portion in the fixtures that is the default.
      expect(viewsDrawn({ alignSelf: "center" })).toHaveLength(2);
    });

    it("should draw the hero card on the surface with the hairline border and the large radius", async () => {
      await renderDetail(scheme);

      expect(screen.getByLabelText("Energy and macros, per 100 g")).toHaveStyle({
        backgroundColor: colorOf("surface"),
        borderColor: colorOf("border"),
        borderWidth: 1,
        borderRadius: 20,
        padding: 16,
      });
    });

    it("should set the energy as the display numeral, with kcal and the basis beside it", async () => {
      await renderDetail(scheme);
      const card = within(screen.getByLabelText("Energy and macros, per 100 g"));

      expect(card.getByText("420")).toHaveStyle({
        fontFamily: "Geist-SemiBold",
        fontSize: 56,
        lineHeight: 60,
        color: colorOf("text-primary"),
      });
      expect(card.getByText("kcal")).toHaveStyle({
        fontFamily: "Geist-SemiBold",
        fontSize: 16,
        color: colorOf("text-secondary"),
      });
      expect(card.getByText("per 100 g")).toHaveStyle({
        fontSize: 12,
        color: colorOf("text-muted"),
      });
    });

    it("should draw each macro on a raised tile, with its colour as a dot", async () => {
      await renderDetail(scheme);

      expect(screen.getByLabelText("Protein, 8.5 g, 8 % of energy")).toHaveStyle({
        backgroundColor: colorOf("surface-raised"),
        borderRadius: 12,
        paddingTop: 10,
        paddingBottom: 10,
        paddingLeft: 12,
        paddingRight: 12,
      });
      for (const macro of ["protein", "carbs", "fat"] as const) {
        expect(
          viewsDrawn({
            width: 8,
            height: 8,
            borderRadius: 2,
            backgroundColor: colorOf(macro),
          }),
        ).toHaveLength(1);
      }
    });

    it("should set a macro's amount as the small numeral, with its unit and share under the label", async () => {
      await renderDetail(scheme);
      const tile = within(screen.getByLabelText("Protein, 8.5 g, 8 % of energy"));

      expect(tile.getByText("Protein")).toHaveStyle({
        fontSize: 12,
        color: colorOf("text-secondary"),
      });
      expect(tile.getByText("8.5")).toHaveStyle({ fontSize: 20, lineHeight: 24 });
      expect(tile.getByText("g")).toHaveStyle({ fontSize: 12, color: colorOf("text-muted") });
      expect(tile.getByText("8 %")).toHaveStyle({ fontSize: 12, color: colorOf("text-secondary") });
    });

    it("should draw the share in a pill with a hairline border", async () => {
      await renderDetail(scheme);

      expect(
        viewsDrawn({
          height: 20,
          borderRadius: 999,
          backgroundColor: colorOf("surface-sheet"),
          borderColor: colorOf("border"),
        }),
        // The three shares and the source badge, which are drawn the same way.
      ).toHaveLength(4);
    });

    it("should write a macro that is not given quieter, in the body size", async () => {
      await renderDetail(scheme, { ...foodFixture, protein_g: null });

      expect(
        within(screen.getByLabelText("Protein, not given")).getByText("not given"),
      ).toHaveStyle({ fontSize: 16, color: colorOf("text-muted") });
    });

    it("should caption the shares in the muted caption style", async () => {
      await renderDetail(scheme);

      expect(screen.getByText("Shares of energy are estimates")).toHaveStyle({
        fontSize: 12,
        lineHeight: 16,
        color: colorOf("text-muted"),
      });
    });

    it("should head the nutrition table in body strong, and draw it on a surface card", async () => {
      await renderDetail(scheme);

      expect(screen.getByRole("heading", { name: "Nutrition per 100 g" })).toHaveStyle({
        fontFamily: "Geist-SemiBold",
        fontSize: 16,
        paddingLeft: 4,
        color: colorOf("text-primary"),
      });
      expect(screen.getByLabelText("Nutrition per 100 g")).toHaveStyle({
        backgroundColor: colorOf("surface"),
        borderColor: colorOf("border"),
        borderRadius: 20,
      });
    });

    it("should draw a row 44 high, padded 16 across, with a hairline above every row after the first", async () => {
      await renderDetail(scheme);

      const energy = screen.getByLabelText("Energy: 420 kcal");
      const protein = screen.getByLabelText("Protein: 8.5 g");
      expect(energy).toHaveStyle({
        minHeight: 44,
        paddingLeft: 16,
        paddingRight: 16,
        justifyContent: "space-between",
      });
      expect(energy).not.toHaveStyle({ borderTopWidth: 1 });
      expect(protein).toHaveStyle({ borderTopWidth: 1, borderColor: colorOf("border") });
    });

    it("should write a row's label in secondary text and its value strong in primary", async () => {
      await renderDetail(scheme);
      const row = within(screen.getByLabelText("Protein: 8.5 g"));

      expect(row.getByText("Protein")).toHaveStyle({
        fontFamily: "Geist-Regular",
        color: colorOf("text-secondary"),
      });
      expect(row.getByText("8.5 g")).toHaveStyle({
        fontFamily: "Geist-SemiBold",
        color: colorOf("text-primary"),
      });
    });

    it("should write a value that is not given regular and muted", async () => {
      await renderDetail(scheme, { ...foodFixture, fibre_g: null });

      expect(within(screen.getByLabelText("Fibre: not given")).getByText("not given")).toHaveStyle({
        fontFamily: "Geist-Regular",
        color: colorOf("text-muted"),
      });
    });

    it("should draw the Edit action as a secondary button 44 high", async () => {
      await renderDetail(scheme);

      expect(screen.getByRole("button", { name: "Edit" })).toHaveStyle({
        height: 44,
        backgroundColor: colorOf("surface-raised"),
        borderColor: colorOf("border"),
        borderRadius: 12,
      });
    });

    it("should draw a portion row 56 high with its amount as the small numeral and its unit muted", async () => {
      await renderDetail(scheme);
      const row = screen.getByLabelText("1 bar, 45 g, Default");

      expect(row).toHaveStyle({ minHeight: 56, paddingLeft: 16, paddingRight: 16 });
      expect(within(row).getByText("1 bar")).toHaveStyle({
        fontFamily: "Geist-SemiBold",
        fontSize: 16,
      });
      expect(within(row).getByText("45")).toHaveStyle({ fontSize: 20 });
      expect(within(row).getByText("g")).toHaveStyle({
        fontSize: 12,
        color: colorOf("text-muted"),
      });
    });

    it("should draw the Default badge as a neutral status with no border", async () => {
      await renderDetail(scheme);

      expect(
        viewsDrawn({
          height: 20,
          backgroundColor: colorOf("surface-sheet"),
          borderColor: "#00000000",
        }),
      ).toHaveLength(1);
    });

    it("should draw the Needs review notice with the warning border and fill, and its action", async () => {
      Object.assign(portionsQuery, { data: [] });
      await renderDetail(scheme, ringsFood);

      expect(
        viewsDrawn({
          backgroundColor: themes[scheme]["warning-muted"],
          borderColor: colorOf("warning"),
          borderWidth: 1,
          borderRadius: 12,
        }),
      ).toHaveLength(1);
      // Warning is the text colour in dark, and the primary text colour in light, where it is too faint.
      const ink = resolvedColor(scheme, "warning-ink");
      expect(screen.getByText("Needs review")).toHaveStyle({ color: ink });
      expect(screen.getByText("Copy to your foods")).toHaveStyle({ color: ink });
    });
  });

  describe.each(schemes)("the failed and not found boards in the %s scheme", (scheme) => {
    it("should keep the failed words 32 in from the sides, and lift them 96 off the bottom", async () => {
      Object.assign(foodQuery, { data: undefined, isError: true });
      await render(
        <ThemeProvider fixedPreference={scheme}>
          <FoodDetailRoute />
        </ThemeProvider>,
      );

      expect(viewsDrawn({ paddingLeft: 32, paddingRight: 32 })).toHaveLength(1);
      expect(viewsDrawn({ paddingBottom: 96 })).toHaveLength(1);
    });

    it("should keep the not found words 32 in from the sides, and lift them 96 off the bottom", async () => {
      Object.assign(foodQuery, { data: null });
      await render(
        <ThemeProvider fixedPreference={scheme}>
          <FoodDetailRoute />
        </ThemeProvider>,
      );

      expect(viewsDrawn({ paddingLeft: 32, paddingRight: 32 })).toHaveLength(1);
      expect(viewsDrawn({ paddingBottom: 96 })).toHaveLength(1);
    });
  });
});
