import { themes } from "@keylow/tokens";
import { render, screen, userEvent } from "@testing-library/react-native";

import { PlateChip } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { resolvedColor } from "../support/themeColor";
import { viewsDrawn } from "../support/viewsDrawn";

import type { PlateChipProps } from "../../components/ui";
import type { ThemeScheme } from "@keylow/tokens";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

const defaultProps: PlateChipProps = { count: 4, onPress: () => undefined };

function renderChip(props: Partial<PlateChipProps> = {}, scheme: ThemeScheme = "dark") {
  return render(
    <ThemeProvider fixedPreference={scheme}>
      <PlateChip {...defaultProps} {...props} />
    </ThemeProvider>,
  );
}

const schemes: ThemeScheme[] = ["dark", "light"];

describe("PlateChip", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles();
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
  });

  describe("what it says", () => {
    it("should be a button named for the plate and its foods", async () => {
      await renderChip({ count: 4 });

      expect(screen.getByRole("button", { name: "Your plate, 4 foods" })).toBeOnTheScreen();
    });

    it("should name one food in the singular", async () => {
      await renderChip({ count: 1 });

      expect(screen.getByRole("button", { name: "Your plate, 1 food" })).toBeOnTheScreen();
    });

    it("should draw the count of foods", async () => {
      await renderChip({ count: 4 });

      expect(screen.getByText("4")).toBeOnTheScreen();
    });

    it("should keep the count on one line however large the text is set", async () => {
      await renderChip({ count: 12 });

      const count = screen.getByText("12");
      expect(count).toHaveProp("numberOfLines", 1);
      expect(count).toHaveProp("maxFontSizeMultiplier", 1.2);
    });
  });

  describe("pressing", () => {
    it("should call onPress when pressed", async () => {
      const user = userEvent.setup();
      const onPress = jest.fn();
      await renderChip({ onPress });

      await user.press(screen.getByRole("button", { name: "Your plate, 4 foods" }));

      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it("should be 44 points high, past the 36 point pill", async () => {
      await renderChip();

      expect(screen.getByRole("button", { name: "Your plate, 4 foods" })).toHaveStyle({
        height: 44,
      });
    });
  });

  describe("disabled", () => {
    it("should report disabled and dim to 40 percent", async () => {
      await renderChip({ disabled: true });

      const chip = screen.getByRole("button", { name: "Your plate, 4 foods" });
      expect(chip).toBeDisabled();
      // NativeWind hands the opacity over as a 32 bit float.
      expect(chip).toHaveStyle({ opacity: Math.fround(0.4) });
    });

    it("should ignore presses", async () => {
      const user = userEvent.setup();
      const onPress = jest.fn();
      await renderChip({ disabled: true, onPress });

      await user.press(screen.getByRole("button", { name: "Your plate, 4 foods" }));

      expect(onPress).not.toHaveBeenCalled();
    });

    it("should not be disabled or dimmed by default", async () => {
      await renderChip();

      const chip = screen.getByRole("button", { name: "Your plate, 4 foods" });
      expect(chip).toBeEnabled();
      expect(chip).not.toHaveStyle({ opacity: Math.fround(0.4) });
    });
  });

  describe.each(schemes)("in the %s scheme", (scheme) => {
    it("should draw a 36 point pill in the accent fill with an accent border", async () => {
      await renderChip({}, scheme);
      await screen.findByText("4");

      expect(
        viewsDrawn({
          height: 36,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: resolvedColor(scheme, "accent"),
          backgroundColor: themes[scheme]["accent-muted"],
        }),
      ).toHaveLength(1);
    });

    it("should write the count in the accent ink, semibold", async () => {
      await renderChip({}, scheme);

      expect(screen.getByText("4")).toHaveStyle({
        color: resolvedColor(scheme, "accent-ink"),
        fontWeight: "600",
      });
    });
  });
});
