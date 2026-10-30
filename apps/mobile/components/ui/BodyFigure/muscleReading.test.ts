import { bodyMapPalette } from "@keylow/tokens";

import { readMuscle } from "./muscleReading";

import type { BodyFigureScale } from "./types";
import type { BodyMapPalette, ThemeScheme } from "@keylow/tokens";

const schemes: ThemeScheme[] = ["dark", "light"];

type ToneRow = [scale: BodyFigureScale, value: number, fillOf: (palette: BodyMapPalette) => string];

// One row per colour token that core's `readMuscleValue` can name, with the palette colour it must map to.
const toneRows: ToneRow[] = [
  ["heat", 0, (palette) => palette.heat[0]],
  ["heat", 1, (palette) => palette.heat[1]],
  ["heat", 2, (palette) => palette.heat[2]],
  ["heat", 3, (palette) => palette.heat[3]],
  ["heat", 4, (palette) => palette.heat[4]],
  ["heat", 5, (palette) => palette.heat[5]],
  ["volume", 0, (palette) => palette.volume.notTrained],
  ["volume", 1, (palette) => palette.volume.maintaining],
  ["volume", 2, (palette) => palette.volume.growing],
  ["volume", 3, (palette) => palette.volume.productive],
  ["volume", 4, (palette) => palette.volume.high],
  ["gap", 0, (palette) => palette.gap.behind],
  ["gap", 1, (palette) => palette.gap.onPlan],
  ["gap", 2, (palette) => palette.gap.ahead],
  ["gap", 3, (palette) => palette.gap.notInPlan],
  ["role", 0, (palette) => palette.heat[0]],
  ["role", 1, (palette) => palette.role.assist],
  ["role", 2, (palette) => palette.role.secondary],
  ["role", 3, (palette) => palette.role.primary],
];

describe.each(schemes)("readMuscle in the %s theme", (scheme) => {
  const palette = bodyMapPalette(scheme);

  it.each(toneRows)(
    "should fill %s value %i with the palette colour of its token",
    (scale, value, fillOf) => {
      expect(readMuscle(scale, value, palette).fill).toBe(fillOf(palette));
    },
  );

  it("should draw a muscle with no value on each scale as core reads it, in the palette colour", () => {
    expect(readMuscle("heat", undefined, palette)).toEqual({
      fill: palette.heat[0],
      valueName: "Rested",
      isPeak: false,
    });
    expect(readMuscle("volume", undefined, palette).fill).toBe(palette.volume.notTrained);
    expect(readMuscle("gap", undefined, palette).fill).toBe(palette.gap.notInPlan);
    expect(readMuscle("role", undefined, palette).fill).toBe(palette.heat[0]);
  });

  it("should pass the spoken value and the glow through from core", () => {
    expect(readMuscle("heat", 5, palette)).toEqual({
      fill: palette.heat[5],
      valueName: "Peak",
      isPeak: true,
    });
  });
});
