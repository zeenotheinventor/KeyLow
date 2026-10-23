import { BODY_MAP, MUSCLE_NAMES, describeGapNote, joinInWords } from "@keylow/core/copy";
import { GAP_VALUES, MUSCLE_IDS } from "@keylow/core/training";

import type { BodyMap } from "@keylow/api-client";

const BEHIND = GAP_VALUES.indexOf("behind");

type GapNoteInput = Pick<BodyMap, "values" | "days"> & {
  /** True from the last day of the week, when the gap counts the whole plan and not only the days so far. */
  countsWholeWeek: boolean;
};

/**
 * The note under the Gap figures: core's `describeGapNote`, told which planned days passed without a
 * session and which muscles read Behind (named in lower case, in the order of the muscle list), and then
 * the line that says the gap counts the days so far while the week is on. With no muscle behind there is
 * nothing for a missed session to have left, so it is not named.
 */
export function describeGap({ values, days, countsWholeWeek }: GapNoteInput): string {
  const behindMuscles = joinInWords(
    MUSCLE_IDS.filter((muscle) => values[muscle] === BEHIND).map((muscle) =>
      MUSCLE_NAMES[muscle].toLowerCase(),
    ),
  );
  const missedSessions =
    behindMuscles === ""
      ? []
      : days
          .filter(({ status }) => status === "missed")
          .map(({ date, plannedDayName }) => ({ localDate: date, routineDayName: plannedDayName }));
  const note = describeGapNote(missedSessions, behindMuscles);
  return countsWholeWeek ? note : `${note} ${BODY_MAP.notes.gapSoFar}`;
}
