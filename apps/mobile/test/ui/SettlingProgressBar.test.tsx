import { isHiddenFromAccessibility, render, screen } from "@testing-library/react-native";

import { SettlingProgressBar } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { resolvedColor } from "../support/themeColor";

import type { SettlingProgressBarProps } from "../../components/ui";
import type { ThemeScheme } from "@keylow/tokens";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

// The caption is hidden from screen readers, since the bar's name says the same, so a query has to ask for it.
const hiddenToo = { includeHiddenElements: true };

async function renderBar(
  props: Partial<SettlingProgressBarProps> = {},
  scheme: ThemeScheme = "dark",
) {
  await render(
    <ThemeProvider fixedPreference={scheme}>
      <SettlingProgressBar count={4} label="Days with a weigh-in" target={8} {...props} />
    </ThemeProvider>,
  );
}

describe("SettlingProgressBar", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles();
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
  });

  describe("accessibility", () => {
    it("should be a progress bar named by the label, the count and the target", async () => {
      await renderBar();

      expect(
        screen.getByRole("progressbar", { name: "Days with a weigh-in, 4 of 8" }),
      ).toBeOnTheScreen();
    });

    it("should say its value from 0 to the target at the count", async () => {
      await renderBar();

      expect(
        screen.getByRole("progressbar", { name: "Days with a weigh-in, 4 of 8" }),
      ).toHaveAccessibilityValue({ min: 0, max: 8, now: 4 });
    });

    it("should read whatever label, count and target it is given", async () => {
      await renderBar({ label: "Complete days", count: 0, target: 10 });

      expect(
        screen.getByRole("progressbar", { name: "Complete days, 0 of 10" }),
      ).toHaveAccessibilityValue({ min: 0, max: 10, now: 0 });
    });

    it("should name the bar by a shorter name than the label when the caller gives one", async () => {
      await renderBar({
        label: "Days your weigh-ins cover, first to last",
        name: "Days your weigh-ins cover",
        count: 14,
        target: 14,
      });

      expect(
        screen.getByRole("progressbar", { name: "Days your weigh-ins cover, 14 of 14" }),
      ).toBeOnTheScreen();
    });

    it("should still write the whole label above the track when the name is shorter", async () => {
      await renderBar({
        label: "Days your weigh-ins cover, first to last",
        name: "Days your weigh-ins cover",
      });

      expect(
        screen.getByText("Days your weigh-ins cover, first to last", hiddenToo),
      ).toBeOnTheScreen();
    });

    it("should be the only progress bar", async () => {
      await renderBar();

      expect(screen.getAllByRole("progressbar")).toHaveLength(1);
    });
  });

  describe("the caption", () => {
    it("should write the label and the count of the target above the track", async () => {
      await renderBar();

      expect(screen.getByText("Days with a weigh-in", hiddenToo)).toBeOnTheScreen();
      expect(screen.getByText("4 of 8", hiddenToo)).toBeOnTheScreen();
    });

    it("should write the count in tabular figures, so counts line up from row to row", async () => {
      await renderBar();

      expect(screen.getByText("4 of 8", hiddenToo).props.style).toMatchObject({
        fontVariant: "tabular-nums",
      });
    });

    it("should hide the caption from screen readers, since the name says the same", async () => {
      await renderBar();

      expect(isHiddenFromAccessibility(screen.getByText("Days with a weigh-in", hiddenToo))).toBe(
        true,
      );
      expect(isHiddenFromAccessibility(screen.getByText("4 of 8", hiddenToo))).toBe(true);
    });

    it("should draw the track alone, named by the label, when the caller has its own words", async () => {
      await renderBar({ hasCaption: false, label: "Weigh-ins towards a settled trend", target: 7 });

      expect(
        screen.getByRole("progressbar", { name: "Weigh-ins towards a settled trend" }),
      ).toHaveAccessibilityValue({ min: 0, max: 7, now: 4 });
      expect(screen.queryByText("4 of 7", hiddenToo)).not.toBeOnTheScreen();
      expect(
        screen.queryByText("Weigh-ins towards a settled trend", hiddenToo),
      ).not.toBeOnTheScreen();
    });
  });

  describe("the fill", () => {
    it.each<[number, number, `${number}%`]>([
      [0, 8, "0%"],
      [4, 8, "50%"],
      [8, 8, "100%"],
      [14, 14, "100%"],
      [6, 14, "42.857142857142854%"],
    ])("should fill %i of %i to %s of the track", async (count, target, width) => {
      await renderBar({ count, target });

      const bar = screen.getByRole("progressbar");

      expect(bar.children[0]).toHaveStyle({ width });
    });

    it("should hold the bar full, and say the target, when the count is past it", async () => {
      await renderBar({ count: 11, target: 8 });

      const bar = screen.getByRole("progressbar", { name: "Days with a weigh-in, 8 of 8" });

      expect(bar).toHaveAccessibilityValue({ min: 0, max: 8, now: 8 });
      expect(bar.children[0]).toHaveStyle({ width: "100%" });
    });

    it("should hold the bar empty when the count is below nothing", async () => {
      await renderBar({ count: -2 });

      const bar = screen.getByRole("progressbar", { name: "Days with a weigh-in, 0 of 8" });

      expect(bar).toHaveAccessibilityValue({ min: 0, max: 8, now: 0 });
      expect(bar.children[0]).toHaveStyle({ width: "0%" });
    });

    it("should leave the bar empty, not broken, when the target is nothing", async () => {
      await renderBar({ count: 3, target: 0 });

      expect(screen.getByRole("progressbar").children[0]).toHaveStyle({ width: "0%" });
    });
  });

  describe.each<ThemeScheme>(["dark", "light"])("in the %s scheme", (scheme) => {
    it("should draw a 6 point track on the raised surface with a warning fill", async () => {
      await renderBar({}, scheme);
      const bar = screen.getByRole("progressbar");

      expect(bar).toHaveStyle({
        height: 6,
        backgroundColor: resolvedColor(scheme, "surface-raised"),
      });
      expect(bar.children[0]).toHaveStyle({ backgroundColor: resolvedColor(scheme, "warning") });
    });
  });
});
