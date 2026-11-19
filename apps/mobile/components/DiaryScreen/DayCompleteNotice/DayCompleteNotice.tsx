import { DAY_COMPLETE_NOTICES } from "@keylow/core/copy";

import { Banner } from "../../ui";

import type { DayCompleteNoticeProps } from "./types";

/**
 * The line above the log that explains the streak window, as board 5 draws it: yesterday can still be
 * completed until 12:00 today, and an older day no longer counts for the streak. Any other state has no
 * notice.
 */
export function DayCompleteNotice({ state }: DayCompleteNoticeProps) {
  if (state === "yesterdayOpen") {
    return (
      <Banner
        icon="Clock"
        size="compact"
        title={DAY_COMPLETE_NOTICES.yesterdayOpen}
        variant="review"
      />
    );
  }
  if (state === "outsideWindow") {
    return <Banner size="compact" title={DAY_COMPLETE_NOTICES.outsideWindow} variant="info" />;
  }
  return null;
}
