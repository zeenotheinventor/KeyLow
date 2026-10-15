import { render, screen, within } from "@testing-library/react-native";

import { MacroHero } from "../../components/FoodDetail/MacroHero";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { viewsDrawn } from "../support/viewsDrawn";

import type { MacroHeroAmount } from "../../components/FoodDetail/MacroHero";

// The hero for an amount: the opt-in `amount` prop of the portion picker. The food detail screen does not
// pass it, and its own tests (detail.test.tsx, detailBoards.test.tsx) stay as they were.

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

// The food's own values, per 100 g, which the amount must replace.
const food = { basis: "per_100g", kcal: 148, protein_g: 32, carbs_g: 0, fat_g: 2.2 } as const;

// 150 g of chicken breast, as the portion.grams board draws it.
const grams150: MacroHeroAmount = {
  caption: "For 150 g",
  values: { kcal: 222, protein_g: 48, carbs_g: 0, fat_g: 3.3 },
};

async function renderHero(amount?: MacroHeroAmount) {
  await render(
    <ThemeProvider fixedPreference="dark">
      <MacroHero amount={amount} food={food} />
    </ThemeProvider>,
  );
}

describe("MacroHero for an amount", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles();
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
  });

  describe("with an amount in grams", () => {
    it("should show the amount's energy and macros in place of the food's own", async () => {
      await renderHero(grams150);

      expect(screen.getByText("222")).toBeOnTheScreen();
      expect(screen.queryByText("148")).not.toBeOnTheScreen();
      expect(screen.getByLabelText("Protein, 48 g, 86 % of energy")).toBeOnTheScreen();
      expect(screen.getByLabelText("Fat, 3.3 g, 13 % of energy")).toBeOnTheScreen();
    });

    it("should write the caption in place of the food's basis, and name the group by it", async () => {
      await renderHero(grams150);

      expect(screen.getByLabelText(/For 150 g/)).toBeOnTheScreen();
      expect(screen.getByText("For 150 g")).toBeOnTheScreen();
      expect(screen.queryByText("per 100 g")).not.toBeOnTheScreen();
    });
  });

  describe("with a portion basis", () => {
    it("should carry the portion's name and size in the caption and in the group's name", async () => {
      await renderHero({ ...grams150, caption: "For 1 medium (100 g)" });

      expect(screen.getByText("For 1 medium (100 g)")).toBeOnTheScreen();
      expect(screen.getByLabelText(/For 1 medium \(100 g\)/)).toBeOnTheScreen();
    });
  });

  describe("with no amount", () => {
    beforeEach(async () => {
      await renderHero({ caption: "For this amount", values: null });
    });

    it("should read a dash for the energy and for each macro, in place of the numbers", () => {
      const hero = within(screen.getByLabelText(/For this amount/));

      expect(hero.getAllByText("–")).toHaveLength(4);
      expect(hero.queryByText("222")).not.toBeOnTheScreen();
      expect(hero.queryByText("148")).not.toBeOnTheScreen();
    });

    it("should say 'For this amount' and name each tile as having no amount", () => {
      expect(screen.getByText("For this amount")).toBeOnTheScreen();
      expect(screen.getByLabelText("Protein, no amount")).toBeOnTheScreen();
      expect(screen.getByLabelText("Carbs, no amount")).toBeOnTheScreen();
      expect(screen.getByLabelText("Fat, no amount")).toBeOnTheScreen();
    });

    it("should draw no share pill and no caption about shares", () => {
      expect(screen.queryByText(/ %$/)).not.toBeOnTheScreen();
      expect(screen.queryByText("Shares of energy are estimates")).not.toBeOnTheScreen();
    });
  });

  describe("with a food that is missing a macro", () => {
    it("should say the macro is not given and give the shares of the other two", async () => {
      await renderHero({
        caption: "For 1 bar (60 g)",
        values: { kcal: 210, protein_g: 19.8, carbs_g: null, fat_g: 7.2 },
      });

      expect(screen.getByLabelText("Carbs, not given")).toBeOnTheScreen();
      expect(screen.getByLabelText("Protein, 20 g, 38 % of energy")).toBeOnTheScreen();
      expect(screen.getByLabelText("Fat, 7.2 g, 31 % of energy")).toBeOnTheScreen();
    });
  });

  describe("without an amount", () => {
    it("should show the food's own values and its basis, as the food detail does", async () => {
      await renderHero();

      expect(screen.getByText("148")).toBeOnTheScreen();
      expect(screen.getByText("per 100 g")).toBeOnTheScreen();
      expect(screen.getByLabelText("Energy and macros, per 100 g")).toBeOnTheScreen();
    });
  });

  describe("the share pills", () => {
    it("should be the Badge's size: 20 points high, padded 8 across, one for each share", async () => {
      await renderHero(grams150);

      // The Badge is the kit's pill with a hairline border; the three shares are drawn as it is.
      expect(
        viewsDrawn({ height: 20, paddingLeft: 8, paddingRight: 8, borderRadius: 999 }),
      ).toHaveLength(3);
    });
  });
});
