import * as copy from "../../../src/copy";

// Every function `src/copy/weekGrid.ts` exports, called with representative arguments. The voice test fails
// when a function has no row, so no sentence escapes the sweep.
export const samples: Record<string, () => string[]> = {
  describeWeekGridDay: () => ["2026-10-12", "2026-10-18"].map(copy.describeWeekGridDay),
  describeWeekGridTitle: () => ["2026-10-12", "2026-12-28"].map(copy.describeWeekGridTitle),
  describeWeekGridBarName: () => ["Mon 12", "Average"].map(copy.describeWeekGridBarName),
  describeWeekGridBarValue: () => [
    copy.describeWeekGridBarValue(2140, 2200),
    copy.describeWeekGridBarValue(2260, 2200),
  ],
  describeWeekGridMacros: () => [
    copy.describeWeekGridMacros({ protein_g: 158, carbs_g: 214, fat_g: 66 }),
    copy.describeWeekGridMacros({ protein_g: 5.55, carbs_g: 0, fat_g: 9.04 }),
  ],
};
