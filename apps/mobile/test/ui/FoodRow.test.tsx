import { themes } from "@keylow/tokens";
import { act, fireEvent, render, screen, userEvent, waitFor } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";
import { getAnimatedStyle, setUpTests } from "react-native-reanimated";

import { FoodRow, GroupedList } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import { animatedRotation, animatedScale } from "../support/animatedStyle";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { resolvedColor } from "../support/themeColor";
import { viewsDrawn } from "../support/viewsDrawn";

import type { FoodRowProps } from "../../components/ui";
import type { ThemeScheme } from "@keylow/tokens";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

setUpTests();

// What @keylow/core/search and @keylow/core/format hand a row for "stock cubes": the segments from
// highlightMatch, the amounts from formatGrams and formatCalories, and the sentence from describeMacros.
const savouryStockCube: FoodRowProps = {
  nameSegments: [
    { text: "Savoury ", matched: false },
    { text: "Stock", matched: true },
    { text: " Cube", matched: false },
  ],
  energy: "250",
  macros: {
    protein: "8",
    carbs: "25",
    fat: "12",
    description: "protein 8 grams, fat 12 grams, carbohydrate 25 grams",
  },
  onPress: () => undefined,
};

const savouryName =
  "Savoury Stock Cube, protein 8 grams, fat 12 grams, carbohydrate 25 grams, 250 kcal";

function renderRow(props: Partial<FoodRowProps> = {}, scheme: ThemeScheme = "dark") {
  return render(
    <ThemeProvider fixedPreference={scheme}>
      <FoodRow {...savouryStockCube} {...props} />
    </ThemeProvider>,
  );
}

function setReduceMotion(isEnabled: boolean): void {
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(isEnabled);
}

async function advance(milliseconds: number) {
  await act(() => {
    jest.advanceTimersByTime(milliseconds);
  });
}

// Icons are decoration and have no role to query by, so their drawings are counted.
function drawings() {
  return screen.root?.queryAll((node) => node.type === "RNSVGSvgView") ?? [];
}

// The spinner is hidden from accessibility, so a query has to ask for hidden elements.
function spinner() {
  return screen.getByTestId("food-row-spinner", { includeHiddenElements: true });
}

const schemes: ThemeScheme[] = ["dark", "light"];

describe("FoodRow", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles();
  });

  beforeEach(() => {
    jest.useFakeTimers();
    registerAppStyles(kitStyles);
    setReduceMotion(false);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe("name and press", () => {
    it("should be a button named by the food with its macros spelled out and its energy", async () => {
      await renderRow();

      expect(screen.getByRole("button", { name: savouryName })).toBeOnTheScreen();
    });

    it("should include the brand in the name", async () => {
      await renderRow({ brand: "Northfield Mills" });

      expect(
        screen.getByRole("button", {
          name: "Savoury Stock Cube, Northfield Mills, protein 8 grams, fat 12 grams, carbohydrate 25 grams, 250 kcal",
        }),
      ).toBeOnTheScreen();
    });

    it("should be named by the food and its note when it has no macros", async () => {
      await renderRow({
        nameSegments: [{ text: "Vegetable Stock Pot", matched: false }],
        energy: undefined,
        macros: undefined,
        note: "Energy not given",
      });

      expect(
        screen.getByRole("button", { name: "Vegetable Stock Pot, Energy not given" }),
      ).toBeOnTheScreen();
    });

    it("should call onPress when pressed", async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const onPress = jest.fn();
      await renderRow({ onPress });

      await user.press(screen.getByRole("button", { name: savouryName }));

      expect(onPress).toHaveBeenCalledTimes(1);
    });
  });

  describe("title", () => {
    it("should write the matched parts in semibold and the rest in regular, so the match reads in bold", async () => {
      await renderRow();

      expect(screen.getByText("Stock")).toHaveStyle({ fontFamily: "Geist-SemiBold" });
      expect(screen.getByText("Savoury")).toHaveStyle({ fontFamily: "Geist-Regular" });
      expect(screen.getByText("Cube")).toHaveStyle({ fontFamily: "Geist-Regular" });
    });

    it("should write the whole title at 16 over 22, which is the boards' line height for a food name", async () => {
      await renderRow();

      for (const part of ["Stock", "Savoury", "Cube"]) {
        expect(screen.getByText(part)).toHaveStyle({ fontSize: 16, lineHeight: 22 });
      }
    });

    it("should give the title two lines before it cuts it short", async () => {
      await renderRow();

      expect(screen.getByText("Savoury Stock Cube")).toHaveProp("numberOfLines", 2);
    });

    it("should write the brand after the title in muted text, set off by a dot", async () => {
      await renderRow({ brand: "Northfield Mills" });

      expect(screen.getByText(" · Northfield Mills")).toHaveStyle({
        color: resolvedColor("dark", "text-muted"),
        fontFamily: "Geist-Regular",
        lineHeight: 22,
      });
    });
  });

  describe("macros", () => {
    it("should write protein, carbohydrate and fat in that order, as the boards do", async () => {
      await renderRow();

      const [protein, carbs, fat] = screen.getAllByText(/^\d+ [PCF]$/);
      expect(protein).toHaveTextContent("8 P");
      expect(carbs).toHaveTextContent("25 C");
      expect(fat).toHaveTextContent("12 F");
      expect(screen.getAllByText(/^\d+ [PCF]$/)).toHaveLength(3);
    });

    it("should write what the macros are per when the basis is not 100 g", async () => {
      await renderRow({ basis: "per 100 ml" });

      expect(screen.getByText("per 100 ml")).toHaveStyle({
        color: resolvedColor("dark", "text-muted"),
      });
    });

    it("should write no basis unless it is given", async () => {
      await renderRow();

      expect(screen.queryByText(/per 100/)).not.toBeOnTheScreen();
    });

    it("should write a note in place of the macros, in muted text", async () => {
      await renderRow({ macros: undefined, energy: undefined, note: "Energy not given" });

      expect(screen.getByText("Energy not given")).toHaveStyle({
        color: resolvedColor("dark", "text-muted"),
        fontFamily: "Geist-Medium",
        fontSize: 12,
      });
      expect(screen.queryByText(/^\d+ [PCF]$/)).not.toBeOnTheScreen();
    });
  });

  describe("energy", () => {
    it("should write the energy as a small numeral with its unit beside it", async () => {
      await renderRow();

      expect(screen.getByText("250")).toHaveStyle({ fontFamily: "Geist-SemiBold", fontSize: 20 });
      expect(screen.getByText("kcal")).toHaveStyle({
        color: resolvedColor("dark", "text-muted"),
        fontSize: 12,
      });
    });

    it("should write no energy when the food has none", async () => {
      await renderRow({ energy: undefined });

      expect(screen.queryByText("250")).not.toBeOnTheScreen();
      expect(screen.queryByText("kcal")).not.toBeOnTheScreen();
    });

    it("should end with a chevron, after the energy", async () => {
      await renderRow();

      // The food icon and the chevron.
      expect(drawings()).toHaveLength(2);
    });
  });

  describe("layout", () => {
    it("should be at least 60 points tall, padded 12 across and 8 down, with 12 between its parts", async () => {
      await renderRow();

      expect(screen.getByRole("button", { name: savouryName })).toHaveStyle({
        minHeight: 60,
        flexDirection: "row",
        alignItems: "center",
        paddingLeft: 12,
        paddingRight: 12,
        paddingTop: 8,
        paddingBottom: 8,
        columnGap: 12,
      });
    });
  });

  describe("in a grouped list", () => {
    function renderTwoRows() {
      return render(
        <ThemeProvider fixedPreference="dark">
          <GroupedList title="Common foods">
            <FoodRow {...savouryStockCube} />
            <FoodRow
              {...savouryStockCube}
              nameSegments={[{ text: "Beef Stock Cubes", matched: false }]}
              energy={undefined}
              macros={undefined}
              note="Energy not given"
            />
          </GroupedList>
        </ThemeProvider>,
      );
    }

    it("should have a hairline above it unless it is the first row", async () => {
      await renderTwoRows();

      expect(screen.getByRole("button", { name: savouryName }).props.style).not.toHaveProperty(
        "borderTopWidth",
      );
      expect(
        screen.getByRole("button", { name: "Beef Stock Cubes, Energy not given" }),
      ).toHaveStyle({ borderTopWidth: 1, borderColor: resolvedColor("dark", "border") });
    });
  });

  describe("disabled", () => {
    it("should be a disabled button at half opacity", async () => {
      await renderRow({ disabled: true });

      const row = screen.getByRole("button", { name: savouryName });
      expect(row).toBeDisabled();
      expect(row).toHaveStyle({ opacity: 0.5 });
    });

    it("should do nothing when pressed", async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const onPress = jest.fn();
      await renderRow({ disabled: true, onPress });

      await user.press(screen.getByRole("button", { name: savouryName }));

      expect(onPress).not.toHaveBeenCalled();
      expect(screen.queryByTestId("press-overlay")).not.toBeOnTheScreen();
    });
  });

  describe("busy", () => {
    const busyProps: Partial<FoodRowProps> = {
      brand: "Northfield Mills",
      macros: undefined,
      energy: undefined,
      busyLabel: "Adding to your foods",
    };
    const busyName = "Savoury Stock Cube, Northfield Mills, Adding to your foods";

    it("should be a busy, disabled button named by the food and what is happening", async () => {
      await renderRow(busyProps);

      const row = screen.getByRole("button", { name: busyName, busy: true });
      expect(row).toBeDisabled();
    });

    it("should say what is happening in place of the macros", async () => {
      await renderRow(busyProps);

      expect(screen.getByText("Adding to your foods")).toHaveStyle({
        color: resolvedColor("dark", "text-secondary"),
        fontSize: 12,
      });
    });

    it("should stay at full strength, because the rows around it are the ones that are dimmed", async () => {
      await renderRow(busyProps);

      expect(
        screen.getByRole("button", { name: busyName, busy: true }).props.style,
      ).not.toHaveProperty("opacity");
    });

    it("should keep the spinner from screen readers, because the row's own name says what is happening", async () => {
      await renderRow(busyProps);

      expect(screen.queryByRole("progressbar")).not.toBeOnTheScreen();
      expect(screen.queryByTestId("food-row-spinner")).not.toBeOnTheScreen();
      expect(spinner()).toBeTruthy();
      expect(screen.getByRole("button", { name: busyName, busy: true })).toBeOnTheScreen();
    });

    it("should show a spinner in place of the energy and the chevron", async () => {
      await renderRow({ ...busyProps, energy: "250" });

      expect(spinner()).toBeOnTheScreen();
      expect(screen.queryByText("250")).not.toBeOnTheScreen();
      // The food icon and the spinner, and no chevron.
      expect(drawings()).toHaveLength(2);
    });

    it("should do nothing when pressed", async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const onPress = jest.fn();
      await renderRow({ ...busyProps, onPress });

      await user.press(screen.getByRole("button", { name: busyName, busy: true }));

      expect(onPress).not.toHaveBeenCalled();
    });

    it("should turn the spinner round", async () => {
      await renderRow(busyProps);
      await advance(100);
      const early = animatedRotation(spinner());

      await advance(250);

      expect(animatedRotation(spinner())).not.toBe(early);
    });

    it("should fade the spinner instead of turning it when the user has reduced motion on", async () => {
      setReduceMotion(true);
      await renderRow(busyProps);
      await advance(100);
      const turningSpinner = spinner();
      const opacities = new Set<unknown>();

      for (let step = 0; step < 8; step += 1) {
        opacities.add(getAnimatedStyle(turningSpinner).opacity);
        await advance(100);
      }

      expect(animatedRotation(turningSpinner)).toBe("0deg");
      expect(opacities.size).toBeGreaterThan(1);
    });
  });

  describe("press feedback", () => {
    it("should compress to the row press scale, 0.985, show the overlay and spring back", async () => {
      await renderRow();
      const row = screen.getByRole("button", { name: savouryName });

      await fireEvent(row, "pressIn");
      await advance(1000);
      expect(animatedScale(screen.getByTestId("press-scale"))).toBeCloseTo(0.985, 3);
      expect(screen.getByTestId("press-overlay")).toBeOnTheScreen();

      await fireEvent(row, "pressOut");
      await advance(1000);
      expect(animatedScale(screen.getByTestId("press-scale"))).toBeCloseTo(1, 3);
    });

    it("should not compress when the user has reduced motion on, and still show the overlay", async () => {
      setReduceMotion(true);
      await renderRow();
      await advance(100);

      await fireEvent(screen.getByRole("button", { name: savouryName }), "pressIn");
      await advance(1000);

      expect(animatedScale(screen.getByTestId("press-scale"))).toBe(1);
      expect(screen.getByTestId("press-overlay")).toBeOnTheScreen();
    });
  });

  describe.each(schemes)("in the %s scheme", (scheme) => {
    it("should draw each macro's colour as a 6 point mark, never as the colour of its text", async () => {
      await renderRow({}, scheme);
      await screen.findByRole("button", { name: savouryName });

      for (const macro of ["protein", "carbs", "fat"] as const) {
        const marks = viewsDrawn({ backgroundColor: resolvedColor(scheme, macro) });
        expect(marks).toHaveLength(1);
        expect(marks[0]).toHaveStyle({ width: 6, height: 6, borderRadius: 2 });
      }
      for (const text of ["8 P", "25 C", "12 F"]) {
        expect(screen.getByText(text)).toHaveStyle({
          color: resolvedColor(scheme, "text-secondary"),
          fontFamily: "Geist-Medium",
          fontSize: 12,
        });
      }
    });

    it("should write the energy in the primary text colour", async () => {
      await renderRow({}, scheme);

      expect(await screen.findByText("250")).toHaveStyle({
        color: resolvedColor(scheme, "text-primary"),
      });
    });

    it("should write the title in the primary text colour", async () => {
      await renderRow({}, scheme);

      expect(await screen.findByText("Stock")).toHaveStyle({
        color: resolvedColor(scheme, "text-primary"),
      });
    });

    it("should draw the spinner in the accent ink: lime in dark, the primary text colour in light", async () => {
      await renderRow({ busyLabel: "Adding to your foods", macros: undefined }, scheme);

      await waitFor(() => {
        expect(spinner()).toBeTruthy();
      });
      // The food icon is drawn in the secondary text colour, so the other drawing is the spinner.
      const [foodIcon, spinnerIcon] = drawings();
      expect(foodIcon).toHaveProp("stroke", themes[scheme]["text-secondary"]);
      expect(spinnerIcon).toHaveProp(
        "stroke",
        scheme === "dark" ? themes.dark.accent : themes.light["text-primary"],
      );
    });
  });
});
