import { themes } from "@keylow/tokens";
import { isHiddenFromAccessibility, render, screen } from "@testing-library/react-native";

import { Sparkline } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";

import type { SparklineProps } from "../../components/ui";
import type { ThemeScheme } from "@keylow/tokens";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

// Skia draws nothing in Jest. The canvas, path and circle here are views that keep the props they were given,
// so a test can read what would have been drawn.
jest.mock("@shopify/react-native-skia", () => {
  const { createElement } = jest.requireActual<typeof import("react")>("react");
  const drawing = (name: string) => (props: object) => createElement(name, props);
  return {
    __esModule: true,
    Canvas: drawing("Canvas"),
    Path: drawing("Path"),
    Circle: drawing("Circle"),
  };
});

async function renderSparkline(
  points: (number | null)[],
  props: Partial<SparklineProps> = {},
  scheme: ThemeScheme = "dark",
) {
  await render(
    <ThemeProvider fixedPreference={scheme}>
      <Sparkline label="Barbell row, up 15 kg" points={points} {...props} />
    </ThemeProvider>,
  );
}

function drawn(type: "Canvas" | "Path" | "Circle") {
  return screen.root?.queryAll((node) => node.type === type) ?? [];
}

describe("Sparkline", () => {
  describe("accessibility", () => {
    it("should be an image named by the label", async () => {
      await renderSparkline([40, 45, 50]);

      expect(screen.getByRole("img", { name: "Barbell row, up 15 kg" })).toBeOnTheScreen();
    });

    it("should be hidden from screen readers when it is decorative", async () => {
      await renderSparkline([40, 45, 50], { decorative: true });

      const [canvas] = drawn("Canvas");

      expect(screen.queryByRole("img")).not.toBeOnTheScreen();
      expect(canvas && isHiddenFromAccessibility(canvas)).toBe(true);
    });
  });

  describe("gaps", () => {
    it("should draw one line through weeks without a gap, with a dot on the latest", async () => {
      await renderSparkline([40, 45, 50]);

      expect(drawn("Path")).toHaveLength(1);
      expect(drawn("Circle")).toHaveLength(1);
    });

    it("should break the line at a skipped week, in two lines, with no point for the gap", async () => {
      await renderSparkline([40, 42, null, 48, 50]);

      expect(drawn("Path")).toHaveLength(2);
      expect(drawn("Circle")).toHaveLength(1);
    });

    it("should put the dot on the end of the line, which stops at the last reading", async () => {
      await renderSparkline([40, 45, null]);

      const [line] = drawn("Path");
      const [dot] = drawn("Circle");

      expect(line?.props.path).toMatch(new RegExp(`L${dot?.props.cx} ${dot?.props.cy}$`));
    });

    it("should draw a reading with a skipped week either side as a dot alone", async () => {
      await renderSparkline([null, 45, null]);

      expect(drawn("Path")).toHaveLength(0);
      expect(drawn("Circle")).toHaveLength(1);
    });

    it("should draw every lone reading as a smaller dot and the latest as the larger one", async () => {
      await renderSparkline([40, null, 45, null, 50]);

      expect(drawn("Path")).toHaveLength(0);

      const dots = drawn("Circle");

      expect(dots).toHaveLength(3);
      expect(dots[0]).toHaveProp("r", 1.5);
      expect(dots[1]).toHaveProp("r", 1.5);
      expect(dots[2]).toHaveProp("r", 2);
    });

    it("should draw a lone reading that is not the latest in the line's colour", async () => {
      await renderSparkline([40, null, 45, 46], { tone: "negative" });

      const [lone, latest] = drawn("Circle");

      expect(lone?.props.r).toBe(1.5);
      expect(lone?.props.color).toBe(themes.dark.danger);
      expect(latest?.props.r).toBe(2);
    });

    it("should draw nothing when no week has a reading", async () => {
      await renderSparkline([null, null]);

      expect(drawn("Path")).toHaveLength(0);
      expect(drawn("Circle")).toHaveLength(0);
    });

    it("should draw nothing for no weeks at all", async () => {
      await renderSparkline([]);

      expect(drawn("Path")).toHaveLength(0);
      expect(drawn("Circle")).toHaveLength(0);
    });
  });

  describe.each<ThemeScheme>(["dark", "light"])("in the %s scheme", (scheme) => {
    it("should draw the neutral line in the trend token and its dot in the marker token", async () => {
      await renderSparkline([40, 45, 50], {}, scheme);

      expect(drawn("Path")[0]?.props.color).toBe(themes[scheme]["chart-trend"]);
      expect(drawn("Circle")[0]?.props.color).toBe(themes[scheme]["chart-marker"]);
    });

    it("should draw a positive line in the success ink and a negative one in the danger colour", async () => {
      await renderSparkline([40, 45, 50], { tone: "positive" }, scheme);

      expect(drawn("Path")[0]?.props.color).toBe(themes[scheme]["success-ink"]);
      expect(drawn("Circle")[0]?.props.color).toBe(themes[scheme]["success-ink"]);
    });

    it("should draw a negative line in the danger colour", async () => {
      await renderSparkline([50, 45, 40], { tone: "negative" }, scheme);

      expect(drawn("Path")[0]?.props.color).toBe(themes[scheme].danger);
    });
  });
});
