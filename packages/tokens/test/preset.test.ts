import resolveConfig from "tailwindcss/resolveConfig";
import { describe, expect, it } from "vitest";

import { colors, fontSize, preset, spacing } from "../src";

const hexOrHslColour =
  /^(#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})|hsla?\(\s*\d{1,3}(\.\d+)?\s*,\s*\d{1,3}(\.\d+)?%\s*,\s*\d{1,3}(\.\d+)?%(\s*,\s*(0|1|0?\.\d+))?\s*\))$/i;

const scaleSteps = ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"];

const collectLeaves = (value: unknown): unknown[] =>
  typeof value === "object" && value !== null
    ? Object.values(value).flatMap(collectLeaves)
    : [value];

describe("preset", () => {
  it("extends the theme with exactly colors, spacing and fontSize", () => {
    expect(Object.keys(preset.theme?.extend ?? {}).sort()).toEqual([
      "colors",
      "fontSize",
      "spacing",
    ]);
  });

  it("carries the exported colors, spacing and fontSize unchanged", () => {
    expect(preset.theme?.extend?.colors).toBe(colors);
    expect(preset.theme?.extend?.spacing).toBe(spacing);
    expect(preset.theme?.extend?.fontSize).toBe(fontSize);
  });
});

describe("preset as consumed by Tailwind", () => {
  const resolvedTheme = resolveConfig({ content: [], presets: [preset] }).theme;

  it("is accepted as a Tailwind preset and resolves into the theme", () => {
    expect(resolvedTheme.colors).toMatchObject({ brand: colors.brand });
    expect(resolvedTheme.spacing["4"]).toBe("16px");
    expect(resolvedTheme.fontSize.base).toEqual(["16px", { lineHeight: "24px" }]);
  });

  it("keeps Tailwind's own theme values alongside the extension", () => {
    expect(resolvedTheme.screens.md).toBe("768px");
  });
});

describe("colors", () => {
  it("defines neutral, brand, success, warning and danger", () => {
    expect(Object.keys(colors).sort()).toEqual([
      "brand",
      "danger",
      "neutral",
      "success",
      "warning",
    ]);
  });

  it.each(Object.entries(colors))("gives %s a scale from 50 to 950", (_name, scale) => {
    expect(Object.keys(scale)).toEqual(scaleSteps);
  });

  it("uses only hex or HSL strings for every colour value", () => {
    const leaves = collectLeaves(colors);
    expect(leaves.length).toBeGreaterThan(0);
    for (const leaf of leaves) {
      expect(leaf).toMatch(hexOrHslColour);
    }
  });

  it("rejects a colour name that is not hex or HSL", () => {
    expect("blue").not.toMatch(hexOrHslColour);
  });
});

describe("spacing", () => {
  it("starts at zero and includes the half step", () => {
    expect(spacing["0"]).toBe("0px");
    expect(spacing["0.5"]).toBe("2px");
  });

  it("uses a 4px base: every key is a multiple of four pixels", () => {
    for (const [step, value] of Object.entries(spacing)) {
      expect(value).toBe(`${Number(step) * 4}px`);
    }
  });

  it("ends at 96", () => {
    expect(spacing["96"]).toBe("384px");
  });
});

describe("fontSize", () => {
  const sizeNames = ["xs", "sm", "base", "lg", "xl", "2xl", "3xl", "4xl", "5xl"];

  it("defines xs to 5xl in order", () => {
    expect(Object.keys(fontSize)).toEqual(sizeNames);
  });

  it("pairs every size with a pixel line height", () => {
    for (const [size, { lineHeight }] of Object.values(fontSize)) {
      expect(size).toMatch(/^\d+px$/);
      expect(lineHeight).toMatch(/^\d+px$/);
    }
  });

  it("grows with every step", () => {
    const pixelSizes = Object.values(fontSize).map(([size]) => parseInt(size, 10));
    expect(pixelSizes).toEqual([...pixelSizes].sort((a, b) => a - b));
    expect(new Set(pixelSizes).size).toBe(pixelSizes.length);
  });
});
