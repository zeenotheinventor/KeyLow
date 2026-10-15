import * as copy from "../../../src/copy";

// Every function `src/copy/datePicker.ts` exports, called with representative arguments. The voice test fails
// when a function has no row, so no sentence escapes the sweep.
export const samples: Record<string, () => string[]> = {
  describeDatePickerMonth: () =>
    ["2026-01", "2026-10", "2027-12"].map(copy.describeDatePickerMonth),
  describeDatePickerDay: () => [
    copy.describeDatePickerDay("2026-10-15", {
      isToday: true,
      isSelected: true,
      isComplete: false,
    }),
    copy.describeDatePickerDay("2026-10-13", {
      isToday: false,
      isSelected: false,
      isComplete: true,
    }),
    copy.describeDatePickerDay("2026-10-01", {
      isToday: false,
      isSelected: false,
      isComplete: false,
    }),
  ],
};
