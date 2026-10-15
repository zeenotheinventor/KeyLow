import { elevation } from "@keylow/tokens";
import { act, fireEvent, render, screen, userEvent } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";
import { setUpTests } from "react-native-reanimated";

import { SearchLauncher } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import { animatedScale } from "../support/animatedStyle";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { resolvedColor } from "../support/themeColor";
import { viewsDrawn } from "../support/viewsDrawn";

import type { SearchLauncherProps } from "../../components/ui";
import type { ThemeScheme } from "@keylow/tokens";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

setUpTests();

function renderLauncher(props: Partial<SearchLauncherProps> = {}, scheme: ThemeScheme = "dark") {
  return render(
    <ThemeProvider fixedPreference={scheme}>
      <SearchLauncher
        label="Search for a food"
        scanLabel="Scan barcode"
        onPress={() => undefined}
        onScanPress={() => undefined}
        {...props}
      />
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

// The bar's compression is the first of the two pressables' wrappers, the barcode control's being the second.
function barScale(): number | undefined {
  const [barWrapper] = screen.getAllByTestId("press-scale");
  if (barWrapper === undefined) {
    throw new Error("The bar has no press wrapper");
  }
  return animatedScale(barWrapper);
}

// The bar's box is three views up from its button: the press wrapper, the flexible slot, then the box.
const barOf = (button: ReturnType<typeof screen.getByRole>) => button.parent?.parent?.parent;

const schemes: ThemeScheme[] = ["dark", "light"];

describe("SearchLauncher", () => {
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

  describe("when disabled", () => {
    it("should disable both controls and press neither, as it is offline", async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const onPress = jest.fn();
      const onScanPress = jest.fn();
      await renderLauncher({ disabled: true, onPress, onScanPress });

      await user.press(screen.getByRole("button", { name: "Search for a food" }));
      await user.press(screen.getByRole("button", { name: "Scan barcode" }));

      expect(screen.getByRole("button", { name: "Search for a food" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Scan barcode" })).toBeDisabled();
      expect(onPress).not.toHaveBeenCalled();
      expect(onScanPress).not.toHaveBeenCalled();
    });

    it("should draw the bar at half strength, as the offline board does", async () => {
      await renderLauncher({ disabled: true });

      expect(barOf(screen.getByRole("button", { name: "Search for a food" }))).toHaveStyle({
        opacity: 0.5,
      });
    });

    it("should be enabled and at full strength by default", async () => {
      await renderLauncher();

      expect(screen.getByRole("button", { name: "Search for a food" })).toBeEnabled();
      expect(barOf(screen.getByRole("button", { name: "Search for a food" }))).not.toHaveStyle({
        opacity: 0.5,
      });
    });
  });

  describe("behaviour", () => {
    it("should be a button named by its label, and not a text input", async () => {
      await renderLauncher();

      expect(screen.getByRole("button", { name: "Search for a food" })).toBeOnTheScreen();
      expect(screen.getByText("Search for a food")).toBeOnTheScreen();
      expect(screen.queryByRole("searchbox")).not.toBeOnTheScreen();
      expect(screen.queryByPlaceholderText("Search for a food")).not.toBeOnTheScreen();
    });

    it("should open the sheet when the bar is pressed, and not the scanner", async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const onPress = jest.fn();
      const onScanPress = jest.fn();
      await renderLauncher({ onPress, onScanPress });

      await user.press(screen.getByRole("button", { name: "Search for a food" }));

      expect(onPress).toHaveBeenCalledTimes(1);
      expect(onScanPress).not.toHaveBeenCalled();
    });

    it("should open the scanner when the barcode control is pressed, and not the sheet", async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const onPress = jest.fn();
      const onScanPress = jest.fn();
      await renderLauncher({ onPress, onScanPress });

      await user.press(screen.getByRole("button", { name: "Scan barcode" }));

      expect(onScanPress).toHaveBeenCalledTimes(1);
      expect(onPress).not.toHaveBeenCalled();
    });

    it("should compress, show the overlay and spring back when the bar is pressed, as every pressable does", async () => {
      await renderLauncher();
      const bar = screen.getByRole("button", { name: "Search for a food" });

      await fireEvent(bar, "pressIn");
      await advance(1000);
      expect(barScale()).toBeCloseTo(0.96, 3);
      expect(screen.getByTestId("press-overlay")).toBeOnTheScreen();

      await fireEvent(bar, "pressOut");
      await advance(1000);
      expect(barScale()).toBeCloseTo(1, 3);
    });

    it("should not compress when the user has reduced motion on, and still show the overlay", async () => {
      setReduceMotion(true);
      await renderLauncher();
      await advance(100);

      await fireEvent(screen.getByRole("button", { name: "Search for a food" }), "pressIn");
      await advance(1000);

      expect(barScale()).toBe(1);
      expect(screen.getByTestId("press-overlay")).toBeOnTheScreen();
    });
  });

  describe.each(schemes)("the look in the %s scheme", (scheme) => {
    it("should be a 44 point field on the raised surface: bordered, rounded medium, with the card elevation", async () => {
      await renderLauncher({}, scheme);
      await screen.findByText("Search for a food");

      const fields = viewsDrawn({
        height: 44,
        backgroundColor: resolvedColor(scheme, "surface-raised"),
        borderColor: resolvedColor(scheme, "border"),
        borderWidth: 1,
        borderRadius: 12,
        boxShadow: elevation[scheme].card,
      });
      expect(fields).toHaveLength(1);
    });

    it("should sit in 16 points either side and 8 above and below, as the frames draw it", async () => {
      await renderLauncher({}, scheme);
      await screen.findByText("Search for a food");

      expect(
        viewsDrawn({ paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8 }),
      ).toHaveLength(1);
    });

    it("should write the label muted in the body style", async () => {
      await renderLauncher({}, scheme);

      expect(await screen.findByText("Search for a food")).toHaveStyle({
        color: resolvedColor(scheme, "text-muted"),
        fontFamily: "Geist-Regular",
        fontSize: 16,
        lineHeight: 24,
      });
    });

    it("should make the bar a 42 point button with 16 points before its search icon", async () => {
      await renderLauncher({}, scheme);

      expect(await screen.findByRole("button", { name: "Search for a food" })).toHaveStyle({
        height: 42,
        paddingLeft: 16,
        columnGap: 8,
      });
    });

    it("should reach a 44 point touch target from the 36 point barcode control", async () => {
      await renderLauncher({}, scheme);

      const control = await screen.findByRole("button", { name: "Scan barcode" });
      expect(control).toHaveStyle({ height: 36, width: 36 });
      expect(control).toHaveProp("hitSlop", 4);
    });
  });
});
