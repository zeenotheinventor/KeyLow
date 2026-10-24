import { themes } from "@keylow/tokens";
import { render, screen } from "@testing-library/react-native";

import { Sparkline } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";

import type { SparklineProps } from "../../components/ui";

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

async function renderSparkline(points: (number | null)[], props: Partial<SparklineProps> = {}) {
  await render(
    <ThemeProvider fixedPreference="dark">
      <Sparkline label="Body fat over the last 90 days" points={points} {...props} />
    </ThemeProvider>,
  );
}

function drawn(type: "Canvas" | "Path" | "Circle") {
  return screen.root?.queryAll((node) => node.type === type) ?? [];
}

describe("Sparkline in the wide size", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles();
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
  });

  it("should be a 128 by 40 canvas", async () => {
    await renderSparkline([40, 45, 50], { size: "wide" });

    expect(drawn("Canvas")[0]).toHaveStyle({ width: 128, height: 40 });
  });

  it("should stay a 64 by 20 canvas when no size is given", async () => {
    await renderSparkline([40, 45, 50]);

    expect(drawn("Canvas")[0]).toHaveStyle({ width: 64, height: 20 });
  });

  it("should keep the line 4 points inside the canvas on every side", async () => {
    await renderSparkline([40, 50], { size: "wide" });

    expect(drawn("Path")[0]).toHaveProp("path", "M4 36 L124 4");
  });

  it("should draw the line 2 points wide", async () => {
    await renderSparkline([40, 45, 50], { size: "wide" });

    expect(drawn("Path")[0]).toHaveProp("strokeWidth", 2);
  });

  it("should draw the latest reading as a 3.5 point dot with a 2 point ring in the surface colour", async () => {
    await renderSparkline([40, 45, 50], { size: "wide" });

    const [dot, ring] = drawn("Circle");

    expect(drawn("Circle")).toHaveLength(2);
    expect(dot).toHaveProp("r", 3.5);
    expect(dot).toHaveProp("color", themes.dark["chart-marker"]);
    expect(ring).toHaveProp("r", 3.5);
    expect(ring).toHaveProp("style", "stroke");
    expect(ring).toHaveProp("strokeWidth", 2);
    expect(ring).toHaveProp("color", themes.dark.surface);
    expect(ring).toHaveProp("cx", dot?.props.cx);
    expect(ring).toHaveProp("cy", dot?.props.cy);
  });

  it("should draw the default dot with no ring", async () => {
    await renderSparkline([40, 45, 50]);

    expect(drawn("Circle")).toHaveLength(1);
    expect(drawn("Circle")[0]).toHaveProp("r", 2);
  });

  it("should place the line by date when the front of the series is padded with nulls", async () => {
    await renderSparkline([null, null, null, 40, 50], { size: "wide" });

    // Three of five days come before the first reading, so the line starts three quarters across.
    expect(drawn("Path")[0]).toHaveProp("path", "M94 36 L124 4");
  });

  it("should draw nothing for a series with no reading", async () => {
    await renderSparkline([null, null], { size: "wide" });

    expect(drawn("Path")).toHaveLength(0);
    expect(drawn("Circle")).toHaveLength(0);
  });
});
