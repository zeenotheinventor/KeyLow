import * as copy from "../../../src/copy";
import { collectStrings } from "../collectStrings";

// Every function `src/copy/bodyComposition.ts` exports, called with representative arguments. The voice
// test fails when a function has no row, so no sentence escapes the sweep.
export const samples: Record<string, () => string[]> = {
  describeBodyValue: () => [
    ...collectStrings(copy.describeBodyValue("body_fat_pct", 22.4)),
    ...collectStrings(copy.describeBodyValue("lean_mass_kg", 63.1)),
  ],
  describeBodyChange: () => [
    copy.describeBodyChange("body_fat_pct", -0.6, 90),
    copy.describeBodyChange("lean_mass_kg", -0.2, 90),
    copy.describeBodyChange("body_fat_pct", 0.4, 30),
    copy.describeBodyChange("body_fat_pct", 0.04, 7),
    copy.describeBodyChange("lean_mass_kg", -1.26, 365),
  ],
  describeBodyChartName: () =>
    ([7, 30, 90, 365] as const).flatMap((range) => [
      copy.describeBodyChartName("body_fat_pct", range, 22.4),
      copy.describeBodyChartName("lean_mass_kg", range, 63.1),
    ]),
  describeBodySettlingLine: () => [
    copy.describeBodySettlingLine(0),
    copy.describeBodySettlingLine(3),
  ],
  describeBodyRangeEmpty: () =>
    ([7, 30, 90, 365] as const).map((range) => copy.describeBodyRangeEmpty(range)),
  describeBodyCounts: () =>
    [
      { bodyFat: 12, leanMass: 12 },
      { bodyFat: 12, leanMass: 0 },
      { bodyFat: 0, leanMass: 12 },
      { bodyFat: 1, leanMass: 1 },
      { bodyFat: 0, leanMass: 0 },
    ].flatMap((counts) => collectStrings(copy.describeBodyCounts(counts))),
  describeCompositionChartName: () =>
    ([7, 30, 90, 365] as const).flatMap((range) => [
      copy.describeCompositionChartName(range, "kg", { fat: 18.2, lean: 64.9 }),
      copy.describeCompositionChartName(range, "pct", { fat: 22.4, lean: 77.6 }),
      copy.describeCompositionChartName(range, "kg", null),
    ]),
  describeCompositionSource: () => [
    copy.describeCompositionSource("body_fat_pct"),
    copy.describeCompositionSource("lean_mass_kg"),
  ],
};
