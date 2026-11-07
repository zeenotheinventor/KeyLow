import { describeCount } from "./counts";

/*
 * The words of the assistant's training cards, from the approved canvas "Ki-Lo assistant screens". Each
 * card has its own block below. A string marked NOT ON THE CANVAS is a draft in the board's style that
 * the designers have not drawn. A goal answer is health data, so none of these functions throws with an
 * answer in its message.
 */

/*
 * `assistant-card · goals-updated` (KEY-904).
 */

/** The title of the card after the person's goal changed. */
export const GOALS_UPDATED_TITLE = "Updated your training goals";

/** The title of the card after a first goal. */
export const GOALS_SAVED_TITLE = "Saved your training goals";

/** The note under an update. */
export const GOALS_UPDATED_NOTE =
  "Your next suggestions use these goals. Your routines stay as they are.";

/** The line under "Undone" when the card saved a first goal, so the person has no goal again. */
export const GOALS_CLEARED_UNDONE = "Your training goals are cleared";

/** "Was Look better", the detail of a changed answer's row. */
export const describeGoalWas = (previousValue: string): string => `Was ${previousValue}`;

/** "goal, days a week", the short fact the changes list shows. The names are the Goal screen's, lower case. */
export const describeGoalsChangeDetail = (rowNames: readonly string[]): string =>
  rowNames.map((name) => name.toLowerCase()).join(", ");

/** "3 days a week", for the note and the line under "Undone". */
export const describeGoalDays = (days: number): string =>
  `${describeCount(days, "day", "days")} a week`;

/** "45 minutes", for the note. */
export const describeGoalMinutes = (minutes: number): string =>
  describeCount(minutes, "minute", "minutes");

/**
 * NOT ON THE CANVAS (KEY-904, the orchestrator's own wording for Zee's review): the note under a first goal,
 * which says what the code chose because the person was asked only for their goal and experience. "Also set
 * to start: 3 days a week, 60 minutes, full gym. Change them on the Goal screen."
 */
export const describeGoalsStartedNote = (chosen: readonly string[]): string =>
  `Also set to start: ${chosen.join(", ")}. Change ${chosen.length === 1 ? "it" : "them"} on the Goal screen.`;

/**
 * "Put back your goal, Look better, and 4 days a week", the line under "Undone". Each item is one changed
 * answer as it was. The board puts a comma before "and" for two items, so the list keeps it.
 */
export const describeGoalsPutBack = (previous: readonly string[]): string => {
  const last = previous.at(-1) ?? "";
  return `Put back ${previous.length < 2 ? last : `${previous.slice(0, -1).join(", ")}, and ${last}`}`;
};

/** "45 minutes a session", one changed answer as it was, for the line under "Undone". */
export const describeGoalMinutesPutBack = (minutes: number): string =>
  `${describeGoalMinutes(minutes)} a session`;

/** "your goal, Look better", one changed answer as it was, for the line under "Undone". */
export const describeGoalAnswerPutBack = (name: string, previousValue: string): string =>
  `your ${name.toLowerCase()}, ${previousValue}`;
