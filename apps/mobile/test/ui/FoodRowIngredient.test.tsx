import { render, screen, userEvent } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";
import { setUpTests } from "react-native-reanimated";

import { FoodRow, IconButton } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { viewsDrawn } from "../support/viewsDrawn";

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

const onionsName = "Onions, raw, 1 medium (110 g), change amount";

// Icons are decoration and have no role to query by, so their drawings are counted.
function drawings() {
  return screen.root?.queryAll((node) => node.type === "RNSVGSvgView") ?? [];
}

describe("FoodRow as an ingredient row", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles();
  });

  beforeEach(() => {
    jest.useFakeTimers();
    registerAppStyles(kitStyles);
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
  });

  afterEach(() => {
    jest.useRealTimers();
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
  describe("when it opens the amount step", () => {
    it("should be a button named by the sentence it is given, which opens the ingredient when pressed", async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const onPress = jest.fn();
      await renderIngredient({ openLabel: onionsName, onPress });

      await user.press(screen.getByRole("button", { name: onionsName }));

      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it("should end without a chevron, as the board draws it", async () => {
      await renderIngredient({ openLabel: onionsName, onPress: () => undefined });

      // The tile's food and the flame.
      expect(drawings()).toHaveLength(2);
    });

    it("should be 4 points from a control beside it, which does not press the row", async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const onPress = jest.fn();
      const onRemove = jest.fn();
      await renderIngredient({
        openLabel: onionsName,
        onPress,
        trailing: <IconButton icon="X" label="Remove Onions, raw" onPress={onRemove} />,
      });

      await user.press(screen.getByRole("button", { name: "Remove Onions, raw" }));

      expect(onRemove).toHaveBeenCalledTimes(1);
      expect(onPress).not.toHaveBeenCalled();
      expect(viewsDrawn({ minHeight: 60, paddingLeft: 12, paddingRight: 4 })).toHaveLength(1);
    });

    it("should be 12 points from the edge when there is no control beside it", async () => {
      await renderIngredient({ openLabel: onionsName, onPress: () => undefined });

      expect(viewsDrawn({ minHeight: 60, paddingLeft: 12, paddingRight: 12 })).toHaveLength(1);
    });
  });
});
