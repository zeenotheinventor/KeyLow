import * as copy from "../../../src/copy";

// Every function `src/copy/assistantDayCards.ts` exports, called with representative arguments. The voice test
// fails when a function has no row, so no sentence escapes the sweep.
export const samples: Record<string, () => string[]> = {
  describeLongDate: () => [copy.describeLongDate("2026-10-24")],
  describeDayCopiedTitle: () => [
    copy.describeDayCopiedTitle("2026-10-24", "2026-10-25", 8),
    copy.describeDayCopiedTitle("2026-10-20", "2026-10-25", 1),
  ],
  describeDayCopiedSub: () => [
    copy.describeDayCopiedSub("2026-10-24", "2026-10-25", "2026-10-25", "1,940 kcal"),
    copy.describeDayCopiedSub("2026-10-24", "2026-10-23", "2026-10-25", null),
  ],
  describeDayCopiedUndone: () => [
    copy.describeDayCopiedUndone(8, "2026-10-25", "2026-10-25"),
    copy.describeDayCopiedUndone(1, "2026-10-23", "2026-10-25"),
  ],
  describeConfirmCopyQuestion: () => [
    copy.describeConfirmCopyQuestion("2026-10-24", "2026-10-25", "2026-10-25", 3, 8),
    copy.describeConfirmCopyQuestion("2026-10-20", "2026-10-23", "2026-10-25", 1, 2),
  ],
  describeDayCompletedTitle: () => [
    copy.describeDayCompletedTitle(true),
    copy.describeDayCompletedTitle(false),
  ],
  describeDayCompletedUndone: () => [
    copy.describeDayCompletedUndone(true),
    copy.describeDayCompletedUndone(false),
  ],
};
