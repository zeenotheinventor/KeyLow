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

const chickenAndRiceName =
  "Chicken and rice, 1 serving 275 grams, makes 4, 374 kilocalories, protein 32 grams, carbohydrate 43 grams, fat 8.1 grams, open";

// What the library hands a recipe row for the golden: the serving and the yield, and the per serving values.
const chickenAndRice: FoodRowProps = {
  layout: "recipe",
  nameSegments: [{ text: "Chicken and rice", matched: false }],
  openLabel: chickenAndRiceName,
  caption: "1 serving (275 g) · makes 4",
  energy: "374",
  macros: { protein: "32", carbs: "43", fat: "8.1", description: "" },
  onPress: () => undefined,
};

async function renderRecipeRow(props: Partial<FoodRowProps> = {}) {
  await render(
    <ThemeProvider fixedPreference="dark">
      <FoodRow {...chickenAndRice} {...props} />
    </ThemeProvider>,
  );
}

// Icons are decoration and have no role to query by, so their drawings are counted.
function drawings() {
  return screen.root?.queryAll((node) => node.type === "RNSVGSvgView") ?? [];
}

describe("FoodRow as a recipe row", () => {
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

  it("should be one button, named by the open label it is given", async () => {
    await renderRecipeRow();

    expect(screen.getByRole("button", { name: chickenAndRiceName })).toBeOnTheScreen();
  });

  it("should write the serving and the yield under the title, then the values of one serving", async () => {
    await renderRecipeRow();

    expect(screen.getByText("Chicken and rice")).toBeOnTheScreen();
    expect(screen.getByText("1 serving (275 g) · makes 4")).toBeOnTheScreen();
    expect(screen.getByText("374")).toBeOnTheScreen();
    expect(screen.getByText("kcal")).toBeOnTheScreen();
    expect(screen.getByText("32 P")).toBeOnTheScreen();
    expect(screen.getByText("43 C")).toBeOnTheScreen();
    expect(screen.getByText("8.1 F")).toBeOnTheScreen();
  });

  it("should draw the recipe tile and the flame, and no chevron or add button", async () => {
    await renderRecipeRow();

    expect(drawings()).toHaveLength(2);
    expect(screen.queryByRole("button", { name: /^Add / })).not.toBeOnTheScreen();
  });

  it("should be 60 points tall at least, as a search result is", async () => {
    await renderRecipeRow();

    expect(viewsDrawn({ minHeight: 60 })).toHaveLength(1);
  });

  it("should write the whole title in semibold when nothing is matched", async () => {
    await renderRecipeRow();

    expect(screen.getByText("Chicken and rice")).toHaveStyle({ fontFamily: "Geist-SemiBold" });
  });

  it("should write only the matched part in semibold when the title is matched", async () => {
    await renderRecipeRow({
      nameSegments: [
        { text: "Chi", matched: true },
        { text: "cken and rice", matched: false },
      ],
    });

    expect(screen.getByText("Chi")).toHaveStyle({ fontFamily: "Geist-SemiBold" });
    expect(screen.getByText("cken and rice")).toHaveStyle({ fontFamily: "Geist-Regular" });
  });

  it("should open the recipe when the row is pressed", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const onPress = jest.fn();
    await renderRecipeRow({ onPress });

    await user.press(screen.getByRole("button", { name: chickenAndRiceName }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  describe("the right padding", () => {
    it("should be 12 points when the row has no control beside it", async () => {
      await renderRecipeRow();

      expect(viewsDrawn({ minHeight: 60, paddingLeft: 12, paddingRight: 12 })).toHaveLength(1);
    });

    it("should be 4 points when a control sits beside the row, as the board draws it", async () => {
      await renderRecipeRow({
        trailing: <IconButton icon="Ellipsis" label="More for Chicken and rice" />,
      });

      expect(viewsDrawn({ minHeight: 60, paddingLeft: 12, paddingRight: 4 })).toHaveLength(1);
      expect(viewsDrawn({ minHeight: 60, paddingLeft: 12, paddingRight: 12 })).toHaveLength(0);
    });
  });

  describe("the trailing slot", () => {
    it("should hold a control of its own beside the row, which does not press the row", async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const onPress = jest.fn();
      const onMore = jest.fn();
      await renderRecipeRow({
        onPress,
        trailing: <IconButton icon="Ellipsis" label="More for Chicken and rice" onPress={onMore} />,
      });

      await user.press(screen.getByRole("button", { name: "More for Chicken and rice" }));

      expect(onMore).toHaveBeenCalledTimes(1);
      expect(onPress).not.toHaveBeenCalled();
    });

    it("should leave nothing in its place when it is not given", async () => {
      await renderRecipeRow();

      expect(screen.getAllByRole("button")).toHaveLength(1);
    });
  });

  describe("the add button of a result that logs one serving", () => {
    const searchResult: Partial<FoodRowProps> = {
      caption: "1 serving (275 g)",
      openLabel:
        "Chicken and rice, recipe, 1 serving 275 grams, 374 kilocalories, protein 32 grams, carbohydrate 43 grams, fat 8.1 grams",
      onPress: undefined,
    };

    it("should add one serving from a button named for the recipe and the serving", async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const onAdd = jest.fn();
      await renderRecipeRow({ ...searchResult, onAdd });

      await user.press(
        screen.getByRole("button", { name: "Add Chicken and rice, 1 serving (275 g)" }),
      );

      expect(onAdd).toHaveBeenCalledTimes(1);
    });

    it("should not be a button itself, with no chevron, while it opens nothing", async () => {
      await renderRecipeRow({ ...searchResult, onAdd: jest.fn() });

      expect(screen.getAllByRole("button")).toHaveLength(1);
      expect(screen.getByLabelText(searchResult.openLabel ?? "")).toBeOnTheScreen();
      // The recipe tile and the flame in front of the energy are all that is drawn, plus the plus.
      expect(drawings()).toHaveLength(3);
    });

    it("should dim the button and stop it responding when adding is disabled", async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const onAdd = jest.fn();
      await renderRecipeRow({ ...searchResult, onAdd, addDisabled: true });

      await user.press(screen.getByRole("button", { name: /^Add Chicken and rice/ }));

      expect(onAdd).not.toHaveBeenCalled();
    });

    it("should sit 4 points from the edge, as a control beside the row does", async () => {
      await renderRecipeRow({ ...searchResult, onAdd: jest.fn() });

      expect(viewsDrawn({ minHeight: 60, paddingLeft: 12, paddingRight: 4 })).toHaveLength(1);
    });

    it("should give way to nothing when the recipe needs review, as a food does", async () => {
      await renderRecipeRow({ ...searchResult, onAdd: jest.fn(), needsReview: true });

      expect(screen.queryByRole("button", { name: /^Add / })).not.toBeOnTheScreen();
    });
  });
});
