import { MUSCLE_IDS } from "@keylow/core/training";
import { bodyMapPalette } from "@keylow/tokens";

import { GLOW_INTENSITY_AT_FULL_ALPHA, looksOf, parseRgba } from "../../components/ui/Body3D/looks";
import { readMuscle } from "../../components/ui/BodyFigure";

import type { BodyFigureScale } from "../../components/ui/BodyFigure";
import type { ThemeScheme } from "@keylow/tokens";

// The looks come from `BodyFigure`'s reading, and its folder reads the saved body choice.
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

const schemes: ThemeScheme[] = ["dark", "light"];

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

describe.each(schemes)("looksOf in the %s theme", (scheme) => {
  const palette = bodyMapPalette(scheme);

  it("should hold a look for each of the 22 muscle ids and no other", () => {
    expect(Object.keys(looksOf("heat", {}, palette)).sort()).toEqual([...MUSCLE_IDS].sort());
  });

  it.each([0, 1, 2, 3, 4, 5])("should colour heat step %i as readMuscle does", (step) => {
    const looks = looksOf("heat", { abs: step }, palette);

    expect(looks.abs.color).toBe(readMuscle("heat", step, palette).fill);
  });

  it.each([0, 1, 2, 3, 4])("should colour volume status %i as readMuscle does", (status) => {
    const looks = looksOf("volume", { abs: status }, palette);

    expect(looks.abs.color).toBe(readMuscle("volume", status, palette).fill);
  });

  it.each([0, 1, 2, 3])("should colour gap value %i as readMuscle does", (gap) => {
    const looks = looksOf("gap", { abs: gap }, palette);

    expect(looks.abs.color).toBe(readMuscle("gap", gap, palette).fill);
  });

  it.each<[BodyFigureScale, number | undefined]>([
    ["heat", undefined],
    ["volume", undefined],
    ["gap", undefined],
    ["heat", 9],
    ["heat", -3],
    ["heat", Number.NaN],
    ["volume", 7],
    ["volume", 1.5],
    ["gap", 12],
    ["gap", -1],
  ])(
    "should read a %s value of %s as readMuscle does, missing and out of range included",
    (scale, value) => {
      const looks = looksOf(scale, value === undefined ? {} : { abs: value }, palette);

      expect(looks.abs.color).toBe(readMuscle(scale, value, palette).fill);
    },
  );

  it("should colour a muscle with no value at rest on heat", () => {
    expect(looksOf("heat", {}, palette).quads.color).toBe(palette.heat[0]);
  });

  it("should glow only at the peak of the heat scale", () => {
    const looks = looksOf(
      "heat",
      { abs: 0, quads: 1, biceps: 2, triceps: 3, calves: 4, chest_upper: 5 },
      palette,
    );

    const glowing = MUSCLE_IDS.filter((id) => looks[id].glow > 0);
    expect(glowing).toEqual(["chest_upper"]);
  });

  it("should never glow on the volume or the gap scale", () => {
    const everyValue = Object.fromEntries(MUSCLE_IDS.map((id, index) => [id, index % 5]));

    for (const scale of ["volume", "gap"] as const) {
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

  it.each([0, 1, 2, 3])("should read volume status %i as warmer than not targeted", (status) => {
    const looks = looksOf("volume", { abs: status }, palette);

    expect(looks.abs.warmth).toBe(1);
    expect(looksOf("volume", {}, palette).abs.warmth).toBe(0);
  });

  it.each([0, 1, 2])("should read gap value %i as warmer than not in the plan", (gap) => {
    expect(looksOf("gap", { abs: gap }, palette).abs.warmth).toBe(1);
    expect(looksOf("gap", {}, palette).abs.warmth).toBe(0);
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
