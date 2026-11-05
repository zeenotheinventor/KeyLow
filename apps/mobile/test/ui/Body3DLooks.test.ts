import { looksOf } from "@keylow/body-3d/looksOf";
import { MUSCLE_IDS } from "@keylow/core/training";
import { bodyMapPalette } from "@keylow/tokens";

import { readMuscle } from "../../components/ui/BodyFigure";

import type { BodyFigureScale } from "../../components/ui/BodyFigure";

// The 2D figure's reading is in the kit folder, which reads the saved body choice.
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

// The looks themselves are tested in the body-3d package. This is the proof that the same value is the same colour in 2D and 3D.
describe.each(["dark", "light"] as const)(
  "the 3D looks against the 2D figure in the %s theme",
  (scheme) => {
    const palette = bodyMapPalette(scheme);

    it.each<[BodyFigureScale, number | undefined]>([
      ["heat", undefined],
      ["heat", 0],
      ["heat", 1],
      ["heat", 2],
      ["heat", 3],
      ["heat", 4],
      ["heat", 5],
      ["heat", 9],
      ["heat", -3],
      ["heat", Number.NaN],
      ["volume", undefined],
      ["volume", 0],
      ["volume", 1],
      ["volume", 2],
      ["volume", 3],
      ["volume", 4],
      ["volume", 7],
      ["volume", 1.5],
      ["gap", undefined],
      ["gap", 0],
      ["gap", 1],
      ["gap", 2],
      ["gap", 3],
      ["gap", 12],
      ["gap", -1],
      ["role", undefined],
      ["role", 0],
      ["role", 1],
      ["role", 2],
      ["role", 3],
      ["role", 4],
      ["role", 1.5],
      ["role", Number.NaN],
    ])("should colour a %s value of %s as readMuscle does", (scale, value) => {
      const looks = looksOf(scale, value === undefined ? {} : { abs: value }, palette);

      expect(looks.abs.color).toBe(readMuscle(scale, value, palette).fill);
    });

    it("should glow exactly where the 2D figure marks a muscle as the peak", () => {
      const values = Object.fromEntries(MUSCLE_IDS.map((id, index) => [id, index % 6]));
      const looks = looksOf("heat", values, palette);

      for (const id of MUSCLE_IDS) {
        expect(looks[id].glow > 0).toBe(readMuscle("heat", values[id], palette).isPeak);
      }
    });
  },
);
