import { themes } from "@keylow/tokens";
import { act, fireEvent, render, screen, userEvent } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";
import { setUpTests } from "react-native-reanimated";

import { FoodRow } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { swipeResponder, touchAt, touchDown } from "../support/swipeResponder";
import { resolvedColor } from "../support/themeColor";
import { viewsDrawn } from "../support/viewsDrawn";

import type { FoodRowProps } from "../../components/ui";
import type { ThemeScheme } from "@keylow/tokens";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

setUpTests();

// What @keylow/core hands the search rows for a banana: the serving is the default portion.
const banana: FoodRowProps = {
  layout: "search",
  nameSegments: [{ text: "Banana", matched: true }],
  caption: "1 medium (100 g)",
  energy: "95",
  macros: {
    protein: "1.2",
    carbs: "20.3",
    fat: "0.1",
    description: "protein 1.2 grams, fat 0.1 grams, carbohydrate 20.3 grams",
  },
  onPress: () => undefined,
  onAdd: () => undefined,
};

const bananaName =
  "Banana, 1 medium (100 g), 95 kilocalories, protein 1.2 grams, carbohydrate 20.3 grams, fat 0.1 grams";
const addBananaName = "Add Banana, 1 medium (100 g)";

// A logged chicken breast, with the time kept in the caption.
const chicken: FoodRowProps = {
  layout: "diary",
  nameSegments: [{ text: "Chicken breast, grilled", matched: false }],
  caption: "12:40 · 150 g",
  energy: "222",
  macros: {
    protein: "48",
    carbs: "0",
    fat: "3.3",
    description: "protein 48 grams, fat 3.3 grams, carbohydrate 0 grams",
  },
  onPress: () => undefined,
};

const chickenName =
  "Chicken breast, grilled, 12:40 · 150 g, 222 kilocalories, protein 48 grams, carbohydrate 0 grams, fat 3.3 grams";

function renderRow(props: Partial<FoodRowProps> = {}, scheme: ThemeScheme = "dark") {
  return render(
    <ThemeProvider fixedPreference={scheme}>
      <FoodRow {...banana} {...props} />
    </ThemeProvider>,
  );
}

function renderDiaryRow(props: Partial<FoodRowProps> = {}, scheme: ThemeScheme = "dark") {
  return renderRow({ ...chicken, ...props }, scheme);
}

// Icons are decoration and have no role to query by, so their drawings are counted.
function drawings() {
  return screen.root?.queryAll((node) => node.type === "RNSVGSvgView") ?? [];
}

const schemes: ThemeScheme[] = ["dark", "light"];

describe("FoodRow in the food log", () => {
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

  describe("search and Recent", () => {
    it("should be a row and an add button, two controls with their own names", async () => {
      await renderRow();

      expect(screen.getByRole("button", { name: bananaName })).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: addBananaName })).toBeOnTheScreen();
    });

    it("should press the row and not the add button when the row is pressed", async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const onPress = jest.fn();
      const onAdd = jest.fn();
      await renderRow({ onPress, onAdd });

      await user.press(screen.getByRole("button", { name: bananaName }));

      expect(onPress).toHaveBeenCalledTimes(1);
      expect(onAdd).not.toHaveBeenCalled();
    });

    it("should add and not press the row when the plus is pressed", async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const onPress = jest.fn();
      const onAdd = jest.fn();
      await renderRow({ onPress, onAdd });

      await user.press(screen.getByRole("button", { name: addBananaName }));

      expect(onAdd).toHaveBeenCalledTimes(1);
      expect(onPress).not.toHaveBeenCalled();
    });

    it("should write the serving under the title in muted text, on one line", async () => {
      await renderRow();

      const serving = screen.getByText("1 medium (100 g)");
      expect(serving).toHaveProp("numberOfLines", 1);
      expect(serving).toHaveStyle({ color: resolvedColor("dark", "text-muted"), fontSize: 12 });
    });

    it("should write the energy on the stats line with a muted kcal suffix, and no big numeral", async () => {
      await renderRow();

      expect(screen.getByText("95")).toHaveStyle({
        color: resolvedColor("dark", "text-secondary"),
        fontFamily: "Geist-Medium",
        fontSize: 12,
      });
      expect(screen.getByText("kcal")).toHaveStyle({ color: resolvedColor("dark", "text-muted") });
    });

    it("should write protein, carbohydrate and fat in that order", async () => {
      await renderRow();

      const [protein, carbs, fat] = screen.getAllByText(/^[\d.]+ [PCF]$/);
      expect(protein).toHaveTextContent("1.2 P");
      expect(carbs).toHaveTextContent("20.3 C");
      expect(fat).toHaveTextContent("0.1 F");
      expect(screen.getAllByText(/^[\d.]+ [PCF]$/)).toHaveLength(3);
    });

    it("should let the stats line wrap between its items, which never break inside", async () => {
      await renderRow();

      expect(screen.getByText("1.2 P")).toHaveProp("numberOfLines", 1);
      const [statsLine] = viewsDrawn({ flexWrap: "wrap" });
      expect(statsLine).toHaveStyle({ flexDirection: "row", columnGap: 10, rowGap: 2 });
    });

    it("should give the title two lines, and keep the whole title in the name", async () => {
      const title =
        "Reduced salt roast chicken breast fillets in a garlic and herb marinade, skinless";
      await renderRow({
        nameSegments: [
          { text: "Reduced salt roast chicken ", matched: true },
          { text: "breast fillets in a garlic and herb marinade, skinless", matched: false },
        ],
      });

      expect(screen.getByText(title)).toHaveProp("numberOfLines", 2);
      expect(
        screen.getByRole("button", { name: new RegExp(`^${title}, 1 medium`) }),
      ).toBeOnTheScreen();
    });

    it("should keep the food icon tile", async () => {
      await renderRow();

      // The tile's food, the flame and the plus.
      expect(drawings()).toHaveLength(3);
    });

    it("should dim the plus and stop it responding when only the plus is disabled", async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const onAdd = jest.fn();
      const onPress = jest.fn();
      await renderRow({ addDisabled: true, onAdd, onPress });
      const plus = screen.getByRole("button", { name: addBananaName });

      await user.press(plus);
      await user.press(screen.getByRole("button", { name: bananaName }));

      expect(plus).toBeDisabled();
      expect(plus).toHaveStyle({ opacity: Math.fround(0.4) });
      expect(onAdd).not.toHaveBeenCalled();
      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it("should name the add button for the food alone when there is no serving to log", async () => {
      await renderRow({ caption: undefined });

      expect(screen.getByRole("button", { name: "Add Banana" })).toBeOnTheScreen();
    });

    it("should dim the plus and stop it responding when the whole row is disabled", async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const onAdd = jest.fn();
      await renderRow({ disabled: true, onAdd });
      const plus = screen.getByRole("button", { name: addBananaName });

      await user.press(plus);

      expect(plus).toBeDisabled();
      expect(plus).toHaveStyle({ opacity: Math.fround(0.4) });
      expect(onAdd).not.toHaveBeenCalled();
    });

    it("should leave the plus a 44 point touch target with no margin around it", async () => {
      await renderRow();

      expect(screen.getByRole("button", { name: addBananaName })).toHaveStyle({
        height: 44,
        width: 44,
      });
      expect(viewsDrawn({ margin: 6 })).toHaveLength(0);
    });

    it("should set the title, the serving and the stats 4 points apart, and the row 60 points tall", async () => {
      await renderRow();

      expect(viewsDrawn({ flexGrow: 1, minWidth: 0, rowGap: 4 })).toHaveLength(1);
      expect(viewsDrawn({ minHeight: 60 })).toHaveLength(1);
    });

    it("should show a chevron and no plus when there is nothing to add", async () => {
      await renderRow({ onAdd: undefined });

      expect(screen.queryByRole("button", { name: addBananaName })).not.toBeOnTheScreen();
      // The tile's food, the flame and the chevron.
      expect(drawings()).toHaveLength(3);
    });
  });

  describe("Recent", () => {
    const recentBanana: Partial<FoodRowProps> = {
      layout: "recent",
      nameSegments: [{ text: "Banana", matched: false }],
      caption: "150 g",
    };

    it("should be a row and an add button, named for the amount last logged", async () => {
      await renderRow(recentBanana);

      expect(
        screen.getByRole("button", { name: /^Banana, 150 g, 95 kilocalories/ }),
      ).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Add Banana, 150 g" })).toBeOnTheScreen();
    });

    it("should be 56 points tall at least, where a search result is 60", async () => {
      await renderRow(recentBanana);

      expect(viewsDrawn({ minHeight: 56 })).toHaveLength(1);
      expect(viewsDrawn({ minHeight: 60 })).toHaveLength(0);
    });

    it("should write the title in semibold, because nothing is matched", async () => {
      await renderRow(recentBanana);

      expect(screen.getByText("Banana")).toHaveStyle({ fontFamily: "Geist-SemiBold" });
    });

    it("should keep the food icon tile", async () => {
      await renderRow(recentBanana);

      // The tile's food, the flame and the plus.
      expect(drawings()).toHaveLength(3);
    });
  });

  describe("a food that needs review", () => {
    const reviewProps: Partial<FoodRowProps> = {
      needsReview: true,
      macros: { protein: "-", carbs: "20.3", fat: "0.1", description: "" },
    };
    const reviewName = "Banana, 1 medium (100 g), 95 kilocalories, Needs review";

    it("should write Needs review in place of the macros, and keep the energy", async () => {
      await renderRow(reviewProps);

      expect(screen.getByText("Needs review")).toBeOnTheScreen();
      expect(screen.getByText("95")).toBeOnTheScreen();
      expect(screen.queryByText(/^[\d.-]+ [PCF]$/)).not.toBeOnTheScreen();
      expect(screen.getByRole("button", { name: reviewName })).toBeOnTheScreen();
    });

    it("should show a chevron in place of the plus, because the portion picker is where it is reviewed", async () => {
      await renderRow(reviewProps);

      expect(screen.queryByRole("button", { name: addBananaName })).not.toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: /^Add / })).not.toBeOnTheScreen();
      // The tile's food, the flame and the chevron.
      expect(drawings()).toHaveLength(3);
    });

    it("should still write Needs review on the stats line when the food has no energy", async () => {
      await renderRow({ ...reviewProps, energy: undefined });

      expect(screen.getByText("Needs review")).toBeOnTheScreen();
      expect(
        screen.getByRole("button", { name: "Banana, 1 medium (100 g), Needs review" }),
      ).toBeOnTheScreen();
      expect(screen.queryByText("kcal")).not.toBeOnTheScreen();
    });

    it("should still write Needs review on a diary row when the food has no energy", async () => {
      await renderDiaryRow({ ...reviewProps, energy: undefined });

      expect(screen.getByText("Needs review")).toBeOnTheScreen();
      expect(
        screen.getByRole("button", {
          name: "Chicken breast, grilled, 12:40 · 150 g, Needs review",
        }),
      ).toBeOnTheScreen();
    });

    it.each(schemes)(
      "should write Needs review in the warning ink in the %s scheme",
      async (scheme) => {
        await renderRow(reviewProps, scheme);

        expect(await screen.findByText("Needs review")).toHaveStyle({
          color: resolvedColor(scheme, "warning-ink"),
        });
      },
    );
  });

  describe("the diary", () => {
    it("should be one button named by the food, when and how much, and the stats in words", async () => {
      await renderDiaryRow();

      expect(screen.getByRole("button", { name: chickenName })).toBeOnTheScreen();
      expect(screen.getAllByRole("button")).toHaveLength(1);
    });

    it("should keep the exact time in the caption", async () => {
      await renderDiaryRow();

      expect(screen.getByText("12:40 · 150 g")).toBeOnTheScreen();
    });

    it("should write the title in semibold, whatever the segments say", async () => {
      await renderDiaryRow();

      expect(screen.getByText("Chicken breast, grilled")).toHaveStyle({
        fontFamily: "Geist-SemiBold",
      });
    });

    it("should have no icon tile and end in a chevron, with the flame on the stats line", async () => {
      await renderDiaryRow();

      // The flame and the chevron.
      expect(drawings()).toHaveLength(2);
    });

    it("should write protein, carbohydrate and fat in that order", async () => {
      await renderDiaryRow();

      const [protein, carbs, fat] = screen.getAllByText(/^[\d.]+ [PCF]$/);
      expect(protein).toHaveTextContent("48 P");
      expect(carbs).toHaveTextContent("0 C");
      expect(fat).toHaveTextContent("3.3 F");
    });

    it("should set the title, the time and amount and the stats 2 points apart", async () => {
      await renderDiaryRow();

      expect(viewsDrawn({ flexGrow: 1, minWidth: 0, rowGap: 2 })).toHaveLength(1);
      expect(viewsDrawn({ minHeight: 56 })).toHaveLength(1);
    });

    it("should have no add button, even when given an add handler", async () => {
      await renderDiaryRow({ onAdd: () => undefined });

      expect(screen.queryByRole("button", { name: /^Add / })).not.toBeOnTheScreen();
    });
  });

  describe("a diary row with nothing to open", () => {
    it("should be plain text named by the food, when and how much, and not a button", async () => {
      await renderDiaryRow({ onPress: undefined });

      expect(screen.getByLabelText(chickenName)).toBeOnTheScreen();
      expect(screen.queryByRole("button")).not.toBeOnTheScreen();
    });

    it("should end without a chevron", async () => {
      await renderDiaryRow({ onPress: undefined });

      // The flame on the stats line only.
      expect(drawings()).toHaveLength(1);
    });

    it("should still offer Delete as an accessibility action, which calls onDelete", async () => {
      const onDelete = jest.fn();
      await renderDiaryRow({ onPress: undefined, onDelete });
      const row = screen.getByLabelText(chickenName);

      expect(row).toHaveProp("accessibilityActions", [{ name: "delete", label: "Delete" }]);
      await fireEvent(row, "accessibilityAction", { nativeEvent: { actionName: "delete" } });

      expect(onDelete).toHaveBeenCalledTimes(1);
    });
  });

  describe("a logged recipe", () => {
    // What the diary hands a recipe entry: core writes the row's name, and the row opens its entry.
    const chickenAndRiceName =
      "18:00, Chicken and rice, recipe, 1 serving 275 grams, 374 kilocalories, protein 32 grams, carbohydrate 43 grams, fat 8.1 grams";
    const chickenAndRice: FoodRowProps = {
      layout: "diary",
      isLoggedRecipe: true,
      nameSegments: [{ text: "Chicken and rice", matched: false }],
      openLabel: chickenAndRiceName,
      caption: "18:00 · 1 serving (275 g)",
      energy: "374",
      macros: { protein: "32", carbs: "43", fat: "8.1", description: "" },
      onPress: () => undefined,
      onAdd: undefined,
    };

    it("should be named by the sentence it is given, and be a button", async () => {
      await renderRow(chickenAndRice);

      expect(screen.getByRole("button", { name: chickenAndRiceName })).toBeOnTheScreen();
    });

    it("should write the name on one line, the time and serving, then the values of the amount", async () => {
      await renderRow(chickenAndRice);

      // The words are the title's inner text, which the title itself clamps.
      expect(screen.getByText("Chicken and rice").parent).toHaveProp("numberOfLines", 1);
      expect(screen.getByText("18:00 · 1 serving (275 g)")).toBeOnTheScreen();
      expect(screen.getByText("374")).toBeOnTheScreen();
      expect(screen.getByText("32 P")).toBeOnTheScreen();
      expect(screen.getByText("43 C")).toBeOnTheScreen();
      expect(screen.getByText("8.1 F")).toBeOnTheScreen();
    });

    it("should draw a chef's hat before the name and a chevron after it", async () => {
      await renderRow(chickenAndRice);

      // The hat, the flame on the stats line and the chevron.
      expect(drawings()).toHaveLength(3);
    });

    it("should be plain text with no chevron while it has nothing to open", async () => {
      await renderRow({ ...chickenAndRice, onPress: undefined });

      expect(screen.queryByRole("button")).not.toBeOnTheScreen();
      expect(drawings()).toHaveLength(2);
    });

    it("should set the 16 point hat 6 points before the name, centred on it and shrinkable", async () => {
      await renderRow(chickenAndRice);

      expect(viewsDrawn({ alignItems: "center", columnGap: 6, flexDirection: "row" })).toHaveLength(
        1,
      );
      expect(screen.getByText("Chicken and rice").parent).toHaveStyle({ flexShrink: 1 });
    });

    it.each(schemes)(
      "should draw the hat 16 points square in the muted ink in the %s scheme",
      async (scheme) => {
        await renderRow(chickenAndRice, scheme);

        // The hat comes first in the row and the flame on the stats line second.
        const [hat] = drawings();
        expect(hat).toHaveProp("stroke", themes[scheme]["text-muted"]);
        expect(hat).toHaveProp("width", 16);
        expect(hat).toHaveProp("height", 16);
      },
    );

    it("should keep the name of a logged food on two lines, with no hat", async () => {
      await renderDiaryRow({ onPress: undefined });

      expect(screen.getByText("Chicken breast, grilled").parent).toHaveProp("numberOfLines", 2);
      expect(drawings()).toHaveLength(1);
    });

    it("should still offer Delete as an accessibility action, which calls onDelete", async () => {
      const onDelete = jest.fn();
      await renderRow({ ...chickenAndRice, onDelete });
      const row = screen.getByLabelText(chickenAndRiceName);

      expect(row).toHaveProp("accessibilityActions", [{ name: "delete", label: "Delete" }]);
      await fireEvent(row, "accessibilityAction", { nativeEvent: { actionName: "delete" } });

      expect(onDelete).toHaveBeenCalledTimes(1);
    });
  });

  describe("swipe to delete", () => {
    it("should offer Delete as an accessibility action on the row, which calls onDelete", async () => {
      const onDelete = jest.fn();
      await renderDiaryRow({ onDelete });
      const row = screen.getByRole("button", { name: chickenName });

      expect(row).toHaveProp("accessibilityActions", [{ name: "delete", label: "Delete" }]);
      await fireEvent(row, "accessibilityAction", { nativeEvent: { actionName: "delete" } });

      expect(onDelete).toHaveBeenCalledTimes(1);
    });

    it("should offer no action when the row cannot be deleted", async () => {
      await renderDiaryRow();

      expect(screen.getByRole("button", { name: chickenName })).not.toHaveProp(
        "accessibilityActions",
      );
    });

    it("should offer no swipe on a search row", async () => {
      await renderRow({ onDelete: () => undefined });

      expect(screen.getByRole("button", { name: bananaName })).not.toHaveProp(
        "accessibilityActions",
      );
      expect(screen.queryByRole("button", { name: "Delete" })).not.toBeOnTheScreen();
    });

    it("should keep the Delete button out of reach of a screen reader while the row is closed", async () => {
      await renderDiaryRow({ onDelete: () => undefined });

      expect(screen.queryByRole("button", { name: "Delete" })).not.toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Delete", hidden: true })).toBeTruthy();
    });

    it("should call onDelete at once when Delete is pressed on a swiped row, with no confirmation", async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const onDelete = jest.fn();
      await renderDiaryRow({ onDelete, startsSwiped: true });

      await user.press(screen.getByRole("button", { name: "Delete" }));

      expect(onDelete).toHaveBeenCalledTimes(1);
    });

    it("should draw Delete 88 points wide with a trash icon, in the on-status text colour on danger", async () => {
      await renderDiaryRow({ onDelete: () => undefined, startsSwiped: true });

      expect(screen.getByRole("button", { name: "Delete" })).toHaveStyle({ width: 88 });
      expect(
        viewsDrawn({ width: 88, backgroundColor: resolvedColor("dark", "danger") }),
      ).toHaveLength(1);
      expect(screen.getByText("Delete")).toHaveStyle({
        color: resolvedColor("dark", "text-on-status"),
      });
      // The trash, the flame and the chevron.
      expect(drawings()).toHaveLength(3);
    });

    it.each(schemes)(
      "should draw the trash in the on-status colour in the %s scheme",
      async (scheme) => {
        await renderDiaryRow({ onDelete: () => undefined, startsSwiped: true }, scheme);

        await screen.findByRole("button", { name: "Delete" });
        const [trash] = drawings();
        expect(trash).toHaveProp("stroke", themes[scheme]["text-on-status"]);
      },
    );

    it("should be open while the screen says it is swiped, and say when a swipe changes it", async () => {
      const onSwipedChange = jest.fn();
      const view = await renderDiaryRow({
        onDelete: () => undefined,
        isSwiped: false,
        onSwipedChange,
      });
      expect(screen.queryByRole("button", { name: "Delete" })).not.toBeOnTheScreen();

      await view.rerender(
        <ThemeProvider fixedPreference="dark">
          <FoodRow
            {...chicken}
            isSwiped
            onDelete={() => undefined}
            onSwipedChange={onSwipedChange}
          />
        </ThemeProvider>,
      );
      await act(() => {
        jest.advanceTimersByTime(500);
      });

      expect(screen.getByRole("button", { name: "Delete" })).toBeOnTheScreen();
      expect(onSwipedChange).not.toHaveBeenCalled();
    });

    describe("by gesture", () => {
      async function dragLeftTo(x: number) {
        const responder = swipeResponder();
        // A slow drag, so that the position decides and not the speed.
        await act(() => {
          responder.onResponderGrant(touchDown);
          responder.onResponderMove(touchAt(x, 100, 400));
          responder.onResponderRelease(touchAt(x, 100, 401));
        });
        await act(() => {
          jest.advanceTimersByTime(500);
        });
      }

      it("should open when dragged more than halfway across the action", async () => {
        await renderDiaryRow({ onDelete: () => undefined });

        await dragLeftTo(240);

        expect(screen.getByRole("button", { name: "Delete" })).toBeOnTheScreen();
      });

      it("should say it opened to the screen when dragged open", async () => {
        const onSwipedChange = jest.fn();
        await renderDiaryRow({ onDelete: () => undefined, onSwipedChange });

        await dragLeftTo(240);

        expect(onSwipedChange).toHaveBeenCalledWith(true);
      });

      it("should spring back closed when dragged less than halfway", async () => {
        await renderDiaryRow({ onDelete: () => undefined });

        await dragLeftTo(280);

        expect(screen.queryByRole("button", { name: "Delete" })).not.toBeOnTheScreen();
      });
    });
  });
});
