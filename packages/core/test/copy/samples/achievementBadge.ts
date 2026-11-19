import * as copy from "../../../src/copy";

// The sentences each function of the achievement badge copy can print, for the voice test's sweep.
export const samples: Record<string, () => string[]> = {
  achievementBadgeLabel: () => [
    copy.achievementBadgeLabel({ id: "month-strong", state: "earned" }),
    copy.achievementBadgeLabel({ id: "month-strong", state: "locked", progress: "12 of 30 days" }),
    copy.achievementBadgeLabel({ id: "month-strong", state: "hidden" }),
  ],
};
