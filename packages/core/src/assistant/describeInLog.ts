import { ASSISTANT_DESCRIBE, ASSISTANT_SHEET } from "../copy/assistantSheet";
import { openingLoggedAt } from "../diary/openingLoggedAt";

import type { LogContext } from "../diary/openingLoggedAt";

/**
 * Where a description from Log food logs: the day being logged, and the time of day it logs at, `HH:MM`. The
 * turn is sent with both (as `localDate` and `localTime`), so the entries land on that day and at that time and not on the day the diary shows.
 */
export type DescribeInLogOpening = { localDate: string; describeAt: string };

/**
 * The opening of the sheet from Describe in Log food. The time is the log context's (an hour's plus names
 * one), and when the sheet was opened without one it is the time a food added from Log food would be logged
 * at, so the hint and the entries agree.
 */
export function describeInLogOpening(
  context: LogContext,
  now: Date,
  timeZone: string,
): DescribeInLogOpening {
  return {
    localDate: context.day,
    describeAt: context.time ?? openingLoggedAt(now, context, timeZone).clockTime,
  };
}

/** What an empty sheet says: the starters' words, or the Describe intro, which has no starters and no not-medical line. */
export type AssistantEmptyWords = {
  heading: string;
  lede: string;
  starters: readonly string[];
  isNotMedicalLineShown: boolean;
};

/** The empty sheet's words for the way it was opened: `describeAt` is the time Describe logs at, given only by Describe. */
export function describeAssistantEmpty(describeAt: string | undefined): AssistantEmptyWords {
  return describeAt === undefined
    ? {
        heading: ASSISTANT_SHEET.emptyHeading,
        lede: ASSISTANT_SHEET.emptyLede,
        starters: ASSISTANT_SHEET.starters,
        isNotMedicalLineShown: true,
      }
    : {
        heading: ASSISTANT_DESCRIBE.emptyHeading,
        lede: ASSISTANT_DESCRIBE.emptyLede,
        starters: [],
        isNotMedicalLineShown: false,
      };
}
