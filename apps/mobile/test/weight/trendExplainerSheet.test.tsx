import { TREND_EXPLAINER } from "@keylow/core/copy";
import { render, screen, userEvent } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { setUpTests } from "react-native-reanimated";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { TrendExplainerSheet } from "../../components/TrendExplainerSheet";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { expectTextsInOrder } from "../support/textsInOrder";
import { resolvedColor } from "../support/themeColor";

import type { TrendExplainerSheetProps } from "../../components/TrendExplainerSheet";
import type { ThemeScheme } from "@keylow/tokens";
import type { StyleProp, ViewStyle } from "react-native";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
jest.mock("@gorhom/bottom-sheet", () =>
  jest
    .requireActual<{ mockBottomSheet: () => unknown }>("../support/sheetScrollViewMock")
    .mockBottomSheet(),
);

setUpTests();

const phone = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, right: 0, bottom: 34, left: 0 },
};
const smallPhone = {
  frame: { x: 0, y: 0, width: 320, height: 568 },
  insets: { top: 20, right: 0, bottom: 0, left: 0 },
};

function renderSheet(
  props: Partial<TrendExplainerSheetProps> = {},
  { scheme = "dark", metrics = phone }: { scheme?: ThemeScheme; metrics?: typeof phone } = {},
) {
  return render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ThemeProvider fixedPreference={scheme}>
        <TrendExplainerSheet open onClose={() => undefined} {...props} />
      </ThemeProvider>
    </SafeAreaProvider>,
  );
}

const FOOTER = "The trend is an estimate. It isn't medical advice.";

type Instance = NonNullable<ReturnType<typeof screen.getByRole>>;

function isInsideScrollView(node: Instance | null): boolean {
  return node !== null && (node.type === "RCTScrollView" || isInsideScrollView(node.parent));
}

// A test instance's props are loosely typed, and a view's style is a style prop. An instance with no style at
// all flattens to nothing.
function styleOf(node: Instance): ViewStyle | undefined {
  return StyleSheet.flatten<ViewStyle>(node.props.style as StyleProp<ViewStyle>);
}

// The nearest ancestor with the 4 points of side padding that bring the sheet's 16 to the board's 20.
function insetAround(node: Instance | null): Instance | null {
  if (node === null) {
    return null;
  }
  return styleOf(node)?.paddingLeft === 4 ? node : insetAround(node.parent);
}

// The icon is decoration, so its drawing is looked for.
function drawings() {
  return screen.root?.queryAll((node) => node.type === "RNSVGSvgView") ?? [];
}

const sectionTitles = TREND_EXPLAINER.sections.map((section) => section.title);
// Each section's heading and then its paragraph.
const sectionTexts = TREND_EXPLAINER.sections.flatMap((section) => [section.title, section.text]);

describe("the trend explainer sheet", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", ["components/TrendExplainerSheet"]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
  });

  describe("by default", () => {
    it("should be a dialog named by the title, with the title as its heading", async () => {
      await renderSheet();

      expect(screen.getByLabelText("How your trend works")).toHaveProp("role", "dialog");
      expect(screen.getByRole("heading", { name: "How your trend works" })).toBeOnTheScreen();
    });

    it("should show the five sections in order, each heading over its paragraph", async () => {
      await renderSheet();

      expectTextsInOrder(screen.getAllByRole("heading"), [
        "How your trend works",
        ...sectionTitles,
      ]);
      expectTextsInOrder(screen.getAllByText(/./), [
        "How your trend works",
        "Done",
        ...sectionTexts,
        FOOTER,
      ]);
    });

    it("should say the trend needs 7 weigh-ins and starts again after 30 days", async () => {
      await renderSheet();

      expect(screen.getByText(/needs 7 weigh-ins before it is steady/)).toBeOnTheScreen();
      expect(screen.getByText(/gap of more than 30 days/)).toBeOnTheScreen();
    });

    it("should end with the line that the trend is an estimate and not medical advice", async () => {
      await renderSheet();

      expect(screen.getByText(FOOTER)).toBeOnTheScreen();
    });

    it("should draw no banner and no progress bar", async () => {
      await renderSheet();

      expect(screen.queryByRole("note")).not.toBeOnTheScreen();
      expect(screen.queryByRole("progressbar")).not.toBeOnTheScreen();
    });

    it("should name neither Apple nor HealthKit", async () => {
      await renderSheet({ settlingObservationCount: 3 });

      expect(screen.queryByText(/Apple|HealthKit/)).not.toBeOnTheScreen();
    });

    it("should close from Done", async () => {
      const user = userEvent.setup();
      const onClose = jest.fn();
      await renderSheet({ onClose });

      await user.press(screen.getByRole("button", { name: "Done" }));

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("should draw nothing once closed", async () => {
      await renderSheet({ open: false });

      expect(screen.queryByRole("dialog")).not.toBeOnTheScreen();
    });
  });

  describe("while the trend settles", () => {
    it.each([
      [3, "Your trend is settling: 3 of 7 weigh-ins"],
      [6, "Your trend is settling: 6 of 7 weigh-ins"],
    ])("should say how many of the 7 weigh-ins there are, with %i", async (count, words) => {
      await renderSheet({ settlingObservationCount: count });

      expect(screen.getByRole("note", { name: words })).toBeOnTheScreen();
    });

    it("should draw a progress bar from 0 to 7 at the count", async () => {
      await renderSheet({ settlingObservationCount: 3 });

      const bar = screen.getByRole("progressbar", { name: "Weigh-ins towards a settled trend" });
      expect(bar).toHaveAccessibilityValue({ min: 0, max: 7, now: 3 });
    });

    it("should hold the bar full when the count is past 7", async () => {
      await renderSheet({ settlingObservationCount: 9 });

      const bar = screen.getByRole("progressbar", { name: "Weigh-ins towards a settled trend" });
      expect(bar).toHaveAccessibilityValue({ min: 0, max: 7, now: 7 });
      expect(bar.children[0]).toHaveStyle({ width: "100%" });
    });

    it("should draw the banner with no icon", async () => {
      await renderSheet({ settlingObservationCount: 3 });

      expect(drawings()).toHaveLength(0);
    });

    it("should draw the banner as the board does: 12 points all round, no border, a 14 over 20 title", async () => {
      await renderSheet({ settlingObservationCount: 3 });

      expect(await screen.findByTestId("banner-box")).toHaveStyle({ padding: 12 });
      expect(screen.getByTestId("banner-box")).not.toHaveStyle({ borderWidth: 1 });
      expect(screen.getByText("Your trend is settling: 3 of 7 weigh-ins")).toHaveStyle({
        fontSize: 14,
        lineHeight: 20,
        fontFamily: "Geist-SemiBold",
      });
    });

    it("should keep the five sections and the footer", async () => {
      await renderSheet({ settlingObservationCount: 3 });

      for (const title of sectionTitles) {
        expect(screen.getByRole("heading", { name: title })).toBeOnTheScreen();
      }
      expect(screen.getByText(FOOTER)).toBeOnTheScreen();
    });

    it("should show the banner above the sections", async () => {
      await renderSheet({ settlingObservationCount: 3 });

      expectTextsInOrder(screen.getAllByText(/./), [
        "How your trend works",
        "Done",
        "Your trend is settling: 3 of 7 weigh-ins",
        ...sectionTexts,
        FOOTER,
      ]);
    });
  });

  describe("the sides", () => {
    it("should hold the title row and the scrolling part 4 points in from the sheet's 16, so they sit 20 from the edge as the board does", async () => {
      await renderSheet();

      const done = await screen.findByRole("button", { name: "Done" });

      const inset = insetAround(done);
      expect(inset).not.toBeNull();
      expect(insetAround(screen.getByText(FOOTER))).toBe(inset);
    });
  });

  describe("Done's right edge", () => {
    it("should end 28 points from the sheet's edge as the board's does, pulled in past the kit button's wider padding", async () => {
      await renderSheet();

      const done = await screen.findByRole("button", { name: "Done" });
      // The sheet's 16 and the row's 4 give 20. The kit button pads 16 and has a 1 point border where the
      // board's pads 8 and has none, so a 9 point pull leaves the label's edge at the board's 28.
      expect(done.parent?.parent).toHaveStyle({ marginRight: -9 });
    });
  });

  describe("on a small phone", () => {
    it("should scroll the banner, sections and footer, with the title and Done fixed above", async () => {
      await renderSheet({ settlingObservationCount: 3 }, { metrics: smallPhone });

      expect(isInsideScrollView(screen.getByText(FOOTER))).toBe(true);
      expect(isInsideScrollView(screen.getByRole("note"))).toBe(true);
      expect(isInsideScrollView(screen.getByRole("heading", { name: "Why a trend" }))).toBe(true);
      expect(isInsideScrollView(screen.getByRole("button", { name: "Done" }))).toBe(false);
      expect(
        isInsideScrollView(screen.getByRole("heading", { name: "How your trend works" })),
      ).toBe(false);
    });
  });

  describe.each(["dark", "light"] as const)("in the %s scheme", (scheme) => {
    it("should set the paragraphs in secondary label text and the footer in muted caption text", async () => {
      await renderSheet({}, { scheme });

      expect(await screen.findByText(TREND_EXPLAINER.sections[0].text)).toHaveStyle({
        fontSize: 14,
        color: resolvedColor(scheme, "text-secondary"),
      });
      expect(screen.getByText(FOOTER)).toHaveStyle({
        fontSize: 12,
        lineHeight: 16,
        color: resolvedColor(scheme, "text-muted"),
      });
    });

    it("should set the paragraphs in the regular weight, as the board does", async () => {
      await renderSheet({}, { scheme });

      expect(await screen.findByText(TREND_EXPLAINER.sections[0].text)).toHaveStyle({
        fontFamily: "Geist-Regular",
        fontSize: 14,
      });
    });

    it("should set Done in the accent ink, semibold", async () => {
      await renderSheet({}, { scheme });

      expect(await screen.findByText("Done")).toHaveStyle({
        color: resolvedColor(scheme, "accent-ink"),
        fontFamily: "Geist-SemiBold",
      });
    });

    it("should set the settling title in the primary text colour", async () => {
      await renderSheet({ settlingObservationCount: 3 }, { scheme });

      expect(await screen.findByText("Your trend is settling: 3 of 7 weigh-ins")).toHaveStyle({
        color: resolvedColor(scheme, "text-primary"),
      });
    });

    it("should set the paragraphs 21 points apart, as the board does", async () => {
      await renderSheet({}, { scheme });

      expect(await screen.findByText(TREND_EXPLAINER.sections[0].text)).toHaveStyle({
        lineHeight: 21,
      });
    });

    it("should draw the bar as a 6 point track on the raised surface with a warning fill", async () => {
      await renderSheet({ settlingObservationCount: 3 }, { scheme });
      const bar = await screen.findByRole("progressbar", {
        name: "Weigh-ins towards a settled trend",
      });

      expect(bar).toHaveStyle({
        height: 6,
        backgroundColor: resolvedColor(scheme, "surface-raised"),
      });
      expect(bar.children[0]).toHaveStyle({ backgroundColor: resolvedColor(scheme, "warning") });
    });

    it("should fill the bar to 3 sevenths", async () => {
      await renderSheet({ settlingObservationCount: 3 }, { scheme });
      const bar = await screen.findByRole("progressbar", {
        name: "Weigh-ins towards a settled trend",
      });

      expect(bar.children[0]).toHaveStyle({ width: "42.857142857142854%" });
    });
  });
});
