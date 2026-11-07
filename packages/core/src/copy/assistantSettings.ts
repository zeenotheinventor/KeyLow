import { ASSISTANT_CARD_WORDS } from "./assistantNotices";
import { describePartialUndo, stateOfOutcome } from "../assistant/cardPresentation";
import { describeChangeSub, timeOfChangeSub } from "../assistant/changes";

import type { AssistantCardUndoOutcome, AssistantChangeRow } from "../assistant";

/*
 * The words of the Assistant row in More and of the Assistant settings screen, as the approved mobile boards
 * print them (canvas "Ki-Lo assistant screens": `tab-shell.more · assistant-row` and
 * `assistant-settings · consent`). The two paragraphs of "What it does" and the Privacy policy label are
 * `ASSISTANT_CONSENT_CARD`, the same words the consent card on the sheet shows, so they are not repeated here.
 */

/**
 * The More row's sub line and value, which follow whether the assistant is on. Until the setting is read
 * (`isOn` undefined) the row has its title alone, as the Programme row does, so it is not drawn Off and then On.
 */
export function describeAssistantMoreRow(isOn: boolean | undefined): {
  title: string;
  subtitle: string | undefined;
  value: string | undefined;
} {
  if (isOn === undefined) {
    return { title: "Assistant", subtitle: undefined, value: undefined };
  }
  return isOn
    ? { title: "Assistant", subtitle: "Log and ask in your own words", value: "On" }
    : { title: "Assistant", subtitle: "Off until you turn it on", value: "Off" };
}

/** The caption under the "Use the assistant" switch. */
export function describeAssistantConsentCaption(isOn: boolean): string {
  return isOn
    ? "On. Open it from the Diary header, the Train header or Describe in Log food."
    : "Off until you turn it on.";
}

/** The Assistant settings screen. "What the assistant changed" belongs to the screen that opens from it. */
export const ASSISTANT_SETTINGS = {
  title: "Assistant",
  back: "Back to More",
  useLabel: "Use the assistant",
  whatItDoes: "What it does",
  yourConversations: "Your conversations",
  deleteAllLabel: "Delete all conversations",
  deleteAllCaption: "Deleting conversations does not undo the changes in them.",
  /** The row that opens "What the assistant changed", first in the conversations group, with the count as its value. */
  changesRowLabel: "What the assistant changed",
} as const;

/** "What the assistant changed" (`assistant-settings · changes`) and its empty state (`changes-empty`). */
export const ASSISTANT_CHANGES = {
  title: "What the assistant changed",
  back: "Back to Assistant",
  footer:
    "Undo works while an item is as the assistant left it. Once you change it in the diary, the recipe editor or Train, change it there. Undo on training waits while a workout is in progress.",
  emptyTitle: "Nothing changed yet",
  emptyBody:
    "When the assistant logs, copies or changes something for you, it shows here with Undo.",
} as const;

/** What a row of the changes list draws after its words: the Undo button, or one of the two plain labels. */
export type AssistantChangeRowTrailing =
  { kind: "action"; label: string } | { kind: "label"; label: string };

export type AssistantChangeRowLook = {
  title: string;
  subtitle: string | undefined;
  /** An undone row's title is muted, because the row stays in the list after an Undo. */
  titleTone: "primary" | "secondary";
  trailing: AssistantChangeRowTrailing;
};

const CHANGED_REASONS: ReadonlySet<string> = new Set(["changed", "active", "logged", "used"]);

const reasonOfPress = (outcome: AssistantCardUndoOutcome | null): string | null =>
  typeof outcome === "object" && outcome !== null && outcome.state === "unavailable"
    ? outcome.reason
    : null;

/**
 * One row of the changes list as the board draws it. The title and sub line are as the server sent them. A
 * row sent with Undo available takes `outcome`, what a press of its Undo came to, until the list is read
 * again. A row that was sent as undone or as not undoable keeps its state.
 *
 * `workoutInProgress` is worked out in the app, never sent, and only a training row heeds it: its Undo
 * waits as the card's does (`assistant-card · undo-unavailable-training`) and returns when the workout
 * ends. A press refused for a workout that has ended since is let go the same way. A training row whose
 * press says the item changed reads so on its sub line, which the list could not know before. A press that
 * put some of a merged row back says how many, on any row.
 */
export function describeAssistantChangeRow(
  row: AssistantChangeRow,
  outcome: AssistantCardUndoOutcome | null,
  { workoutInProgress = false }: { workoutInProgress?: boolean } = {},
): AssistantChangeRowLook {
  // A refusal for a workout holds only while the workout does.
  const pressed =
    reasonOfPress(outcome) === "workout_in_progress" && !workoutInProgress ? null : outcome;
  const pressedReason = reasonOfPress(pressed);
  const isOffered = row.state === "undo";
  const state =
    isOffered && pressed !== null
      ? stateOfOutcome(pressed) === "undone"
        ? "undone"
        : "cant_undo"
      : row.state;
  const isWaiting =
    row.training !== undefined &&
    isOffered &&
    ((state === "undo" && workoutInProgress) || pressedReason === "workout_in_progress");

  const time = timeOfChangeSub(row.sub);
  const pressedDetail =
    !isOffered || pressed === null
      ? null
      : typeof pressed === "object" && pressed.state === "partial"
        ? describePartialUndo(row.training?.kind ?? null, pressed)
        : row.training !== undefined && pressedReason !== null && CHANGED_REASONS.has(pressedReason)
          ? row.training.changedSinceDetail
          : null;
  const words = {
    title: row.title,
    subtitle:
      pressedDetail === null
        ? (row.sub ?? undefined)
        : time === null
          ? pressedDetail
          : describeChangeSub(time, pressedDetail),
  };

  if (isWaiting) {
    return {
      ...words,
      titleTone: "primary",
      trailing: { kind: "label", label: ASSISTANT_CARD_WORDS.waitUndoLabel },
    };
  }
  switch (state) {
    case "undo":
      return {
        ...words,
        titleTone: "primary",
        trailing: { kind: "action", label: ASSISTANT_CARD_WORDS.undoLabel },
      };
    case "undone":
      return {
        ...words,
        titleTone: "secondary",
        trailing: { kind: "label", label: ASSISTANT_CARD_WORDS.undoneTitle },
      };
    case "cant_undo":
      return {
        ...words,
        titleTone: "primary",
        trailing: { kind: "label", label: ASSISTANT_CARD_WORDS.cannotUndoLabel },
      };
  }
}

/**
 * The confirmation before Delete all conversations. The boards draw none, and the delete cannot be undone, so
 * this is KEY-695's recommendation and awaits Zee. Its frame is added to the canvas later. The body names "What the assistant
 * changed", which KEY-696 adds, so the Undo sentence is back.
 */
export const ASSISTANT_DELETE_ALL_DIALOG = {
  title: "Delete all conversations?",
  body: "This removes every conversation with the assistant. Changes it made to your diary and recipes stay, and you can still undo them from What the assistant changed.",
  confirmLabel: "Delete",
  cancelLabel: "Keep them",
} as const;

/**
 * The toast when Delete all conversations fails, after `COPY_FAILED_BANNER`'s wording. NOT ON THE CANVAS: no
 * board draws it, so it awaits Zee.
 */
export const DELETE_FAILED_BANNER = "Not deleted. Check your connection and try again.";
