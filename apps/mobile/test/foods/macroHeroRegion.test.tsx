import { render, screen, within } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";

import { MacroHero } from "../../components/FoodDetail/MacroHero";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";

import type { MacroHeroRegionProps } from "../../components/FoodDetail/MacroHero";

type PerServingAmount = MacroHeroRegionProps["amount"];

// The hero as the recipe editor's Per serving card: the opt-in `amount.region`. The food screens do not
// pass it, and macroHero.test.tsx keeps checking them as they were.

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

const goldenServing: PerServingAmount = {
  caption: "Per serving (275 g)",
  values: { kcal: 374, protein_g: 32.1, carbs_g: 43.2, fat_g: 8.1 },
  region: {
    name: "Per serving",
    footnote: "Per 100 g cooked: 136 kcal",
    announcement: "374 kilocalories per serving",
  },
};

function tree(amount: PerServingAmount) {
  return (
    <ThemeProvider fixedPreference="dark">
      <MacroHero amount={amount} />
    </ThemeProvider>
  );
}

describe("MacroHero as the Per serving card", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles();
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should be a region named by the card, with its caption, values and the line under the macros", async () => {
    await render(tree(goldenServing));

    const card = within(screen.getByLabelText("Per serving"));
    expect(card.getByText("374")).toBeOnTheScreen();
    expect(card.getByText("Per serving (275 g)")).toBeOnTheScreen();
    expect(card.getByLabelText(/^Protein, 32 g/)).toBeOnTheScreen();
    expect(card.getByText("Per 100 g cooked: 136 kcal")).toBeOnTheScreen();
  });

  it("should leave out the note about the shares, which the line under the macros replaces", async () => {
    await render(tree(goldenServing));

    expect(screen.queryByText(/estimates/)).not.toBeOnTheScreen();
  });

  it("should draw dashes and the plain caption while there is nothing to work out", async () => {
    await render(
      tree({
        caption: "Per serving",
        values: null,
        region: { name: "Per serving", announcement: "" },
      }),
    );

    const card = within(screen.getByLabelText("Per serving"));
    expect(card.getByText("Per serving")).toBeOnTheScreen();
    expect(card.getByLabelText("Protein, no amount")).toBeOnTheScreen();
    expect(card.queryByText(/Per 100 g/)).not.toBeOnTheScreen();
  });

  it("should say nothing when it first appears, and tell a screen reader when its values change", async () => {
    const { rerender } = await render(tree(goldenServing));
    expect(AccessibilityInfo.announceForAccessibility).not.toHaveBeenCalled();

    await rerender(
      tree({
        ...goldenServing,
        region: { name: "Per serving", announcement: "299 kilocalories per serving" },
      }),
    );

    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledTimes(1);
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith(
      "299 kilocalories per serving",
    );
  });
});
