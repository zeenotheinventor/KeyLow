import { MUSCLE_IDS } from "@keylow/core/training";
import { bodyMapPalette } from "@keylow/tokens";
import { describe, expect, it } from "vitest";

import { fillsOf, GLOW_INTENSITY_AT_FULL_ALPHA, looksOf, parseRgba } from "../src/looksOf";

import type { BodyFigureScale } from "@keylow/core/training";

describe("parseRgba", () => {
  it("should split an rgba string into an opaque colour and its alpha", () => {
    expect(parseRgba("rgba(240,72,72,0.55)")).toEqual({ color: "rgb(240, 72, 72)", alpha: 0.55 });
  });

  it("should allow spaces, and read rgb with no alpha as fully opaque", () => {
    expect(parseRgba("rgb( 1 , 2 , 3 )")).toEqual({ color: "rgb(1, 2, 3)", alpha: 1 });
  });

  it("should throw on anything else, without echoing it", () => {
    expect(() => parseRgba("hotpink")).toThrow("The glow colour is not an rgb or rgba string.");
  });
});

describe("fillsOf", () => {
  it.each(["dark", "light"] as const)(
    "should give each of the 17 tones a colour of the %s palette",
    (scheme) => {
      const palette = bodyMapPalette(scheme);
      const paletteColours = [
        ...palette.heat,
        ...Object.values(palette.volume),
        ...Object.values(palette.gap),
        ...Object.values(palette.role),
      ];
      const fills = Object.values(fillsOf(palette));

      expect(fills).toHaveLength(17);
      for (const fill of fills) {
        expect(paletteColours).toContain(fill);
      }
    },
  );
});

describe.each(["dark", "light"] as const)("looksOf in the %s theme", (scheme) => {
  const palette = bodyMapPalette(scheme);

  const volumeFills = [
    palette.volume.notTrained,
    palette.volume.maintaining,
    palette.volume.growing,
    palette.volume.productive,
    palette.volume.high,
  ];
  const gapFills = [palette.gap.behind, palette.gap.onPlan, palette.gap.ahead];
  const roleFills = [
    palette.heat[0],
    palette.role.assist,
    palette.role.secondary,
    palette.role.primary,
  ];

  it("should hold a look for each of the 22 muscle ids and no other", () => {
    expect(Object.keys(looksOf("heat", {}, palette)).sort()).toEqual([...MUSCLE_IDS].sort());
  });

  it.each([0, 1, 2, 3, 4, 5])("should colour heat step %i as the heat token", (step) => {
    expect(looksOf("heat", { abs: step }, palette).abs.color).toBe(palette.heat[step]);
  });

  it.each([0, 1, 2, 3, 4])("should colour volume status %i as its volume token", (status) => {
    expect(looksOf("volume", { abs: status }, palette).abs.color).toBe(volumeFills[status]);
  });

  it.each([0, 1, 2])("should colour gap value %i as its gap token", (gap) => {
    expect(looksOf("gap", { abs: gap }, palette).abs.color).toBe(gapFills[gap]);
  });

  it("should colour a gap value of 3 as not in the plan", () => {
    expect(looksOf("gap", { abs: 3 }, palette).abs.color).toBe(palette.gap.notInPlan);
  });

  it.each([0, 1, 2, 3])("should colour role value %i as its role token", (role) => {
    expect(looksOf("role", { abs: role }, palette).abs.color).toBe(roleFills[role]);
  });

  it.each<[BodyFigureScale, number | undefined, string]>([
    ["heat", undefined, palette.heat[0]],
    ["volume", undefined, palette.volume.notTrained],
    ["gap", undefined, palette.gap.notInPlan],
    ["role", undefined, palette.heat[0]],
    ["heat", 9, palette.heat[5]],
    ["heat", -3, palette.heat[0]],
    ["heat", Number.NaN, palette.heat[0]],
    ["volume", 7, palette.volume.notTrained],
    ["volume", 1.5, palette.volume.notTrained],
    ["gap", 12, palette.gap.notInPlan],
    ["gap", -1, palette.gap.notInPlan],
    ["role", 4, palette.heat[0]],
    ["role", 1.5, palette.heat[0]],
    ["role", Number.NaN, palette.heat[0]],
  ])(
    "should rest a %s value of %s, missing and out of range included",
    (scale, value, restingFill) => {
      const values = value === undefined ? {} : { abs: value };

      expect(looksOf(scale, values, palette).abs.color).toBe(restingFill);
    },
  );

  it("should glow only at the peak of the heat scale", () => {
    const looks = looksOf(
      "heat",
      { abs: 0, quads: 1, biceps: 2, triceps: 3, calves: 4, chest_upper: 5 },
      palette,
    );

    expect(MUSCLE_IDS.filter((id) => looks[id].glow > 0)).toEqual(["chest_upper"]);
  });

  it("should never glow on the volume, gap or role scale", () => {
    const everyValue = Object.fromEntries(MUSCLE_IDS.map((id, index) => [id, index % 5]));

    for (const scale of ["volume", "gap", "role"] as const) {
      const looks = looksOf(scale, everyValue, palette);
      expect(MUSCLE_IDS.filter((id) => looks[id].glow > 0)).toEqual([]);
    }
  });

  it.each([0, 1, 2, 3, 4, 5])("should read heat step %i as that warm", (step) => {
    expect(looksOf("heat", { abs: step }, palette).abs.warmth).toBe(step);
  });

  it("should read a muscle with no heat as not warm at all", () => {
    expect(looksOf("heat", {}, palette).abs.warmth).toBe(0);
  });

  it.each([1, 2, 3, 4])("should read volume status %i as warmer than not trained", (status) => {
    expect(looksOf("volume", { abs: status }, palette).abs.warmth).toBe(1);
    expect(looksOf("volume", {}, palette).abs.warmth).toBe(0);
  });

  it.each([0, 1, 2])("should read gap value %i as warmer than not in the plan", (gap) => {
    expect(looksOf("gap", { abs: gap }, palette).abs.warmth).toBe(1);
    expect(looksOf("gap", {}, palette).abs.warmth).toBe(0);
  });

  it("should read a muscle at rest on the role scale as not warm and any role as warm", () => {
    expect(looksOf("role", {}, palette).abs.warmth).toBe(0);
    expect(looksOf("role", { abs: 0 }, palette).abs.warmth).toBe(0);
    for (const role of [1, 2, 3]) {
      expect(looksOf("role", { abs: role }, palette).abs.warmth).toBe(1);
    }
  });

  it("should glow by the alpha of the heat glow token, in its colour", () => {
    const { chest_upper: peak } = looksOf("heat", { chest_upper: 5 }, palette);
    const { color, alpha } = parseRgba(palette.heatGlow);

    expect(peak.glowColor).toBe(color);
    expect(peak.glow).toBeCloseTo(alpha * GLOW_INTENSITY_AT_FULL_ALPHA);
  });

  it("should give a muscle that does not glow the same glow colour, so a fade between them only moves the strength", () => {
    const looks = looksOf("heat", { chest_upper: 5, abs: 2 }, palette);

    expect(looks.abs.glowColor).toBe(looks.chest_upper.glowColor);
  });
});
