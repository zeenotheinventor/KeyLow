import { MONTH_NAMES_LONG } from "./diaryDay";
import { parseCalendarDay } from "../dates/calendarDay";

import type { AssistantNotice, AssistantStreamEvent } from "../assistant";

/*
 * The words of the assistant's notices and states, as the approved mobile boards print them (canvas
 * "Ki-Lo assistant screens"). Screens render these and never word a notice themselves.
 */

/** A notice shown in the thread, with the composer's disabled words when the composer is off. */
export type AssistantNoticeDescription = {
  title: string;
  body: string;
  /** What the disabled composer says, or null when the composer stays on. */
  fieldText: string | null;
  /** The notice's one button, or null when it has none. */
  button: string | null;
};

/** Every notice but the consent card, which is a card of its own: `ASSISTANT_CONSENT_CARD`. */
export type DescribableAssistantNotice = Exclude<AssistantNotice, { code: "consent_needed" }>;

const EVERYTHING_ELSE_WORKS = "Everything else in Ki-Lo works as normal.";
const LOGGING_STILL_WORKS = "Logging, search and quick add work as normal.";

/** "1 November", from a `YYYY-MM-DD` day. */
const dayAndMonth = (calendarDate: string): string => {
  const { month, day } = parseCalendarDay(calendarDate);
  return `${day} ${MONTH_NAMES_LONG[month - 1]}`;
};

/**
 * The words of a notice (`assistant · day-limit`, `plus`, `resting`, `unavailable`). The day limit
 * reads "Back at midnight" as its board does, whatever `resetsAt` holds.
 */
export function describeAssistantNotice(
  notice: DescribableAssistantNotice,
): AssistantNoticeDescription {
  switch (notice.code) {
    case "day_limit":
      return {
        title: "You have used today's turns",
        body: `The assistant is back at midnight. ${LOGGING_STILL_WORKS}`,
        fieldText: "Back at midnight",
        button: null,
      };
    case "plus":
      return {
        title: "The assistant is part of Ki-Lo Plus",
        body: `Your account does not include Ki-Lo Plus at the moment. ${LOGGING_STILL_WORKS}`,
        fieldText: "Not on your account",
        button: null,
      };
    case "resting":
      return {
        title: `The assistant is resting until ${dayAndMonth(notice.resumesOn)}`,
        body: `It has reached this month's limit. Your conversations are kept. ${EVERYTHING_ELSE_WORKS}`,
        fieldText: `Back on ${dayAndMonth(notice.resumesOn)}`,
        button: null,
      };
    case "switched_off":
      return {
        title: "The assistant is switched off for now",
        body: `Try again later. ${EVERYTHING_ELSE_WORKS}`,
        fieldText: "Switched off for now",
        button: null,
      };
    case "turn_failed":
      return {
        title: "That answer did not come through",
        body: "Nothing was changed. Check your connection and try again.",
        fieldText: null,
        button: "Try again",
      };
  }
}

/** The status line while no text arrives (`assistant · recipe-import`, left). */
export function describeAssistantStatus(
  status: Omit<Extract<AssistantStreamEvent, { type: "status" }>, "type">,
): string {
  return `Reading the recipe at ${status.host}`;
}

/** Offline is the app's own state, with no notice code (`assistant · unavailable`, right). */
export const ASSISTANT_OFFLINE = {
  title: "You're offline",
  body: "The assistant needs a connection. Your diary still works.",
  fieldText: "Needs a connection",
} as const;

/** A reply cut short by closing the sheet keeps its text, with this line and one quick reply. */
export const ASSISTANT_STOPPED = {
  label: "Stopped when you closed the assistant",
  askAgain: "Ask again",
} as const;

/** Under the starters on the empty sheet and at the start of the consent card's small print. */
export const ASSISTANT_NOT_MEDICAL_ADVICE =
  "The assistant's answers are not medical advice. Speak to a doctor before you make big changes to your diet or your weight.";

/** The consent card (`assistant · consent-needed`), the same words as the Settings consent row. */
export const ASSISTANT_CONSENT_CARD = {
  title: "Turn on the assistant",
  paragraphs: [
    "The assistant answers questions about your diary, weight and targets, and logs, copies and changes entries for you. Every change shows as a card with Undo.",
    "To do this, your messages and the Ki-Lo data the assistant reads are sent to Anthropic, the company that runs its AI model, as Ki-Lo's processor. Anthropic keeps them for up to 30 days. Ki-Lo keeps your conversations until you delete them.",
  ],
  privacyLinkLabel: "Privacy policy",
  smallPrint: `${ASSISTANT_NOT_MEDICAL_ADVICE} You can turn the assistant off in More, Assistant.`,
  turnOnLabel: "Turn on",
  notNowLabel: "Not now",
} as const;

/**
 * The words the action card draws around what the server sends: the tick's name and the badge on a recipe
 * line (`assistant · recipe-import`, `assistant · recipe-unresolved`), the Estimate badge, the Undo button
 * and its plain-words twin (`assistant-card · logged`, `assistant-card · undo-unavailable`), and the title
 * of a card after an Undo (`assistant-card · undone`, with the card's `undoneSub` under it). The card
 * schema carries none of them, so a screen takes them from here and never words them.
 */
export const ASSISTANT_CARD_WORDS = {
  matchedLabel: "Matched",
  notMatchedLabel: "Not matched",
  estimateLabel: "Estimate",
  undoLabel: "Undo",
  cannotUndoLabel: "Can't undo",
  undoneTitle: "Undone",
} as const;
