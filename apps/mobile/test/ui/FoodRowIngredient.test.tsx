import { render, screen } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";
import { setUpTests } from "react-native-reanimated";

import { FoodRow } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";

import type { FoodRowProps } from "../../components/ui";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

setUpTests();

// An ingredient of the editor's Ingredients list, as the board draws one: the food, the amount it is used
// in, and what that amount comes to.
const onions: FoodRowProps = {
  layout: "ingredient",
  nameSegments: [{ text: "Onions, raw", matched: false }],
  caption: "1 medium (110 g)",
  energy: "39",
  macros: { protein: "1.1", carbs: "8.8", fat: "0.1", description: "" },
};

async function renderIngredient(props: Partial<FoodRowProps> = {}) {
  await render(
    <ThemeProvider fixedPreference="dark">
      <FoodRow {...onions} {...props} />
    </ThemeProvider>,
  );
}

describe("FoodRow as an ingredient row", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles();
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should read as the food, the amount, then the energy and the macros, with nothing to press", async () => {
    await renderIngredient();

    expect(
      screen.getByLabelText(
        "Onions, raw, 1 medium (110 g), 39 kilocalories, protein 1.1 grams, carbohydrate 8.8 grams, fat 0.1 grams",
      ),
    ).toBeOnTheScreen();
    expect(screen.queryByRole("button")).not.toBeOnTheScreen();
    expect(screen.getByText("1 medium (110 g)")).toBeOnTheScreen();
    expect(screen.getByText("1.1 P")).toBeOnTheScreen();
  });

  it("should say it needs review in place of the macros when the food gives none of them", async () => {
    await renderIngredient({ macros: undefined, needsReview: true });

    expect(screen.getByText("Needs review")).toBeOnTheScreen();
    expect(screen.queryByText(/ P$/)).not.toBeOnTheScreen();
  });

  it("should write the whole name in the strong weight, as nothing is matched", async () => {
    await renderIngredient();

    expect(screen.getByText("Onions, raw")).toHaveStyle({ fontWeight: "600" });
  });
});
