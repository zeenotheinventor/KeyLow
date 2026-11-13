import { ASSISTANT_CARD_WORDS } from "../copy/assistantNotices";
import { ASSISTANT_CARD_NOTES } from "../copy/assistantSheet";
import {
  PARTLY_UNDONE_NOTE,
  PARTLY_UNDONE_UNKNOWN_NOTE,
  describeChangesPartlyUndone,
  describeSetsPartlyPutBack,
} from "../copy/assistantTrainingCards";

import type {
  AssistantCard,
  AssistantCardDay,
  AssistantCardKind,
  AssistantCardLink,
  AssistantCardRow,
} from "./card";

/*
 * What the action card draws for a card the assistant sent: the icon of its kind, its words as sent and
 * the state of its Undo. The sheet draws what this returns and decides nothing itself. A card's strings
 * are worded by the write that made it and are passed through unchanged, so nothing here builds, rounds or
 * converts an amount.
 */

/** The icons the boards draw on a card, by their names in the app's icon set. */
export type AssistantCardIconName =
  | "Check"
  | "Copy"
  | "ChefHat"
  | "Trash2"
  | "Apple"
  | "Target"
  | "RotateCcw"
  | "Archive"
  | "MessageSquareText";

export type AssistantCardIconTone = "success" | "secondary" | "muted";

const kindLooks: Record<
  AssistantCardKind,
  { icon: AssistantCardIconName; tone: AssistantCardIconTone }
> = {
  logged: { icon: "Check", tone: "success" },
  updated: { icon: "Check", tone: "success" },
  deleted: { icon: "Trash2", tone: "secondary" },
  day_copied: { icon: "Copy", tone: "secondary" },
  day_completed: { icon: "Check", tone: "success" },
  recipe_created: { icon: "ChefHat", tone: "success" },
  recipe_updated: { icon: "ChefHat", tone: "success" },
  recipe_archived: { icon: "ChefHat", tone: "secondary" },
  food_created: { icon: "Apple", tone: "success" },
  targets_changed: { icon: "Target", tone: "secondary" },
  routine_updated: { icon: "Check", tone: "success" },
  routine_active: { icon: "Check", tone: "success" },
  routine_archived: { icon: "Archive", tone: "secondary" },
  routine_created: { icon: "Check", tone: "success" },
  goals_updated: { icon: "Target", tone: "secondary" },
  exercise_created: { icon: "Check", tone: "success" },
  exercise_updated: { icon: "Check", tone: "success" },
  exercise_archived: { icon: "Archive", tone: "secondary" },
  set_updated: { icon: "Check", tone: "success" },
  workout_deleted: { icon: "Trash2", tone: "secondary" },
  feature_requested: { icon: "MessageSquareText", tone: "secondary" },
  // NOT ON THE CANVAS. The plan boards do not exist yet, so these reuse the plain tick until they do.
  plan_created: { icon: "Check", tone: "success" },
  plan_day_replanned: { icon: "Check", tone: "success" },
};

const TRAINING_CARD_KINDS: ReadonlySet<AssistantCardKind> = new Set([
  "routine_updated",
  "routine_active",
  "routine_archived",
  "routine_created",
  "goals_updated",
  "exercise_created",
  "exercise_updated",
  "exercise_archived",
  "set_updated",
  "workout_deleted",
]);

/** The kinds of card a training write builds, whose Undo waits while a workout is in progress. */
export const isTrainingCardKind = (kind: AssistantCardKind): boolean =>
  TRAINING_CARD_KINDS.has(kind);

/**
 * `available` is the Undo button, `unavailable` the plain words Can't undo (or Can't undo yet, while a
 * workout is in progress), and `done` draws no action.
 * A `done` card has no label to draw, so its label is the title it takes.
 */
export type AssistantCardUndoLook = {
  state: "available" | "unavailable" | "done";
  label: string;
};

type AssistantCardRowLook = {
  name: string;
  detail: string;
  value?: string;
  estimateLabel?: string;
} & (
  | { match?: undefined; matchLabel?: undefined }
  | { match: NonNullable<AssistantCardRow["match"]>; matchLabel: string }
);

export type AssistantCardLook = {
  icon: AssistantCardIconName;
  iconTone: AssistantCardIconTone;
  title: string;
  subtitle: string | null;
  rows: AssistantCardRowLook[];
  /** The days of a routine, each opening to its exercises. Empty on every card but a routine's, and on an undone card. */
  days: AssistantCardDay[];
  total: string | null;
  note: string | null;
  link: AssistantCardLink | null;
  undo: AssistantCardUndoLook;
};

/**
 * What the person's own Undo came to, for a card that was sent as available. An unavailable answer that
 * said why keeps its reason, and `workout_in_progress` is the one that clears by itself. A card that groups
 * several writes can come out `partial`: the route undoes each action on its own, so some were put back
 * (`undone` of `total`) and the rest were refused.
 */
export type AssistantCardUndoOutcome =
  | "undone"
  | "unavailable"
  | { state: "unavailable"; reason: AssistantUndoReason }
  | { state: "partial"; undone: number; total: number; reason?: AssistantUndoReason };

/** One code of the undo route's answer for each action id. */
export type AssistantUndoCode = "undone" | "already_undone" | "undo_unavailable" | "not_found";

/** Why the undo route refused: the target changed, the routine is active or was logged from, the exercise was used, or a workout is in progress. */
export type AssistantUndoReason = "changed" | "active" | "logged" | "used" | "workout_in_progress";

/** The undo route's answer for one action id: its code, and the reason when it refused with one. */
export type AssistantUndoAnswer = {
  result: AssistantUndoCode;
  reason?: AssistantUndoReason | undefined;
};

const answerOf = (answer: AssistantUndoCode | AssistantUndoAnswer): AssistantUndoAnswer =>
  typeof answer === "string" ? { result: answer } : answer;

const isPutBack = ({ result }: AssistantUndoAnswer): boolean =>
  result === "undone" || result === "already_undone";

/**
 * What a card's Undo came to: undone once every action is (already undone counts, someone got there
 * first). When only some were put back it is partial, with how many, because the card would otherwise say
 * nothing was, and it keeps the first refusal's reason. Otherwise unavailable, whether an action's entries changed or were not found, and the first
 * action that was not undone gives the reason, when it sent one. Codes alone are read as they always were.
 */
export function undoOutcomeOfResults(
  results: readonly (AssistantUndoCode | AssistantUndoAnswer)[],
): AssistantCardUndoOutcome {
  const answers = results.map(answerOf);
  const refused = answers.find((answer) => !isPutBack(answer));
  if (answers.length > 0 && refused === undefined) {
    return "undone";
  }
  const undone = answers.filter(isPutBack).length;
  if (undone > 0) {
    return {
      state: "partial",
      undone,
      total: answers.length,
      ...(refused?.reason === undefined ? {} : { reason: refused.reason }),
    };
  }
  return refused?.reason === undefined
    ? "unavailable"
    : { state: "unavailable", reason: refused.reason };
}

// Undo archives a recipe and deletes a food, so once a card is undone only a link to the diary still leads somewhere.
const isLinkToDiary = (link: AssistantCardLink): boolean => link.target.screen === "diary_day";

// The cards that make or copy diary entries, which Undo cannot take back once the entries were changed.
const KINDS_OF_DIARY_ENTRIES: ReadonlySet<AssistantCardKind> = new Set(["logged", "day_copied"]);

const joined = (parts: readonly (string | null)[]): string =>
  parts.flatMap((part) => (part === null ? [] : [part])).join(" · ");

function describeRow(row: AssistantCardRow): AssistantCardRowLook {
  const words = {
    name: row.name,
    detail: joined([row.amountText, row.matchedFood, row.time]),
    ...(row.kcalText === null ? {} : { value: row.kcalText }),
    ...(row.estimate ? { estimateLabel: ASSISTANT_CARD_WORDS.estimateLabel } : {}),
  };
  switch (row.match) {
    case "matched":
      return { ...words, match: "matched", matchLabel: ASSISTANT_CARD_WORDS.matchedLabel };
    case "unresolved":
      return { ...words, match: "unresolved", matchLabel: ASSISTANT_CARD_WORDS.notMatchedLabel };
    case null:
      return words;
  }
}

/** The words of a partial outcome: what was put back. */
export function describePartialUndo(
  kind: AssistantCardKind | null,
  { undone, total }: { undone: number; total: number },
): string {
  return kind === "set_updated"
    ? describeSetsPartlyPutBack(undone, total)
    : describeChangesPartlyUndone(undone, total);
}

/** The reason a press was refused for, from an unavailable or a partial outcome, or null when there is none. */
export const reasonOfOutcome = (
  outcome: AssistantCardUndoOutcome | null,
): AssistantUndoReason | null =>
  typeof outcome === "object" && outcome !== null ? (outcome.reason ?? null) : null;

// Why the rest of a partial outcome was not put back. A refusal that gave no reason says nothing about why,
// since a failed write can be tried again.
const partialNoteOf = (
  kind: AssistantCardKind,
  outcome: { undone: number; total: number },
  reason: AssistantUndoReason | null,
): string =>
  `${describePartialUndo(kind, outcome)}. ${
    reason === null || reason === "workout_in_progress"
      ? PARTLY_UNDONE_UNKNOWN_NOTE
      : PARTLY_UNDONE_NOTE
  }`;

/** The Undo state a press leaves a card in. A partial outcome is unavailable, because what is left cannot be undone. */
export const stateOfOutcome = (outcome: AssistantCardUndoOutcome): "undone" | "unavailable" =>
  outcome === "undone" ? "undone" : "unavailable";

// Why a training card's Undo is off, from the kind and the reason the undo route gave, or null when the
// reason has no line for the kind. A kind with one way to lose its Undo needs no reason.
function trainingNoteOfRefusal(
  kind: AssistantCardKind,
  reason: AssistantUndoReason | null,
): string | null {
  switch (kind) {
    case "routine_updated":
      return reason === "changed"
        ? ASSISTANT_CARD_NOTES.routineChanged
        : reason === "logged"
          ? ASSISTANT_CARD_NOTES.routineDayWasLogged
          : null;
    case "routine_created":
      return reason === "changed"
        ? ASSISTANT_CARD_NOTES.routineChanged
        : reason === "active"
          ? ASSISTANT_CARD_NOTES.routineIsActive
          : reason === "logged"
            ? ASSISTANT_CARD_NOTES.routineWasLogged
            : null;
    case "routine_active":
      return ASSISTANT_CARD_NOTES.anotherRoutineIsActive;
    case "routine_archived":
      return ASSISTANT_CARD_NOTES.routineRestored;
    case "goals_updated":
      return ASSISTANT_CARD_NOTES.goalsChanged;
    case "exercise_created":
      return reason === "changed"
        ? ASSISTANT_CARD_NOTES.exerciseChanged
        : reason === "used"
          ? ASSISTANT_CARD_NOTES.exerciseWasUsed
          : null;
    case "exercise_updated":
      return reason === "changed" ? ASSISTANT_CARD_NOTES.exerciseChanged : null;
    case "exercise_archived":
      return ASSISTANT_CARD_NOTES.exerciseRestored;
    case "set_updated":
      return ASSISTANT_CARD_NOTES.setChanged;
    case "workout_deleted":
      return ASSISTANT_CARD_NOTES.workoutRestored;
    default:
      return null;
  }
}

/**
 * The card as the sheet draws it. `outcome` is what an Undo pressed on this card came to, which is
 * the card's state until the thread is read again, and only for a card that was sent as available.
 * `workoutInProgress` is worked out in the app, never sent: a training card whose Undo is still available
 * draws Can't undo yet while a workout is in progress, and Undo comes back when it ends. A press refused
 * for a workout that has ended since is let go the same way.
 */
export function describeAssistantCard(
  card: AssistantCard,
  outcome: AssistantCardUndoOutcome | null = null,
  { workoutInProgress = false }: { workoutInProgress?: boolean } = {},
): AssistantCardLook {
  // A refusal for a workout holds only while the workout does.
  const pressed =
    reasonOfOutcome(outcome) === "workout_in_progress" && !workoutInProgress ? null : outcome;
  const pressedReason = reasonOfOutcome(pressed);
  const undo = card.undo === "available" && pressed !== null ? stateOfOutcome(pressed) : card.undo;

  if (undo === "undone") {
    return {
      icon: "RotateCcw",
      iconTone: "muted",
      title: ASSISTANT_CARD_WORDS.undoneTitle,
      subtitle: card.undoneSub,
      rows: [],
      days: [],
      total: null,
      note: null,
      link: card.link !== null && isLinkToDiary(card.link) ? card.link : null,
      undo: { state: "done", label: ASSISTANT_CARD_WORDS.undoneTitle },
    };
  }

  const { icon, tone } = kindLooks[card.kind];
  const isTraining = isTrainingCardKind(card.kind);
  const isWaiting =
    isTraining &&
    card.undo === "available" &&
    undo === "available" &&
    (workoutInProgress || pressedReason === "workout_in_progress");
  const isUnavailable = undo === "unavailable";
  const looksSame = {
    icon,
    iconTone: tone,
    title: card.title,
    subtitle: card.sub,
    rows: card.rows.map(describeRow),
    days: card.days ?? [],
    total: card.totalText,
    link: card.link,
  };

  if (isWaiting || (isUnavailable && pressedReason === "workout_in_progress" && isTraining)) {
    return {
      ...looksSame,
      // What an Undo put back stays true while the rest waits.
      note:
        typeof pressed === "object" && pressed?.state === "partial"
          ? `${describePartialUndo(card.kind, pressed)}. ${ASSISTANT_CARD_NOTES.waitForWorkout}`
          : ASSISTANT_CARD_NOTES.waitForWorkout,
      undo: { state: "unavailable", label: ASSISTANT_CARD_WORDS.waitUndoLabel },
    };
  }

  const refusalNote =
    isUnavailable && isTraining ? trainingNoteOfRefusal(card.kind, pressedReason) : null;
  const partialNote =
    isUnavailable && typeof pressed === "object" && pressed?.state === "partial"
      ? partialNoteOf(card.kind, pressed, pressedReason)
      : null;

  return {
    ...looksSame,
    note:
      partialNote ??
      refusalNote ??
      card.note ??
      (isUnavailable && KINDS_OF_DIARY_ENTRIES.has(card.kind)
        ? ASSISTANT_CARD_NOTES.entriesChanged
        : null),
    undo: isUnavailable
      ? { state: "unavailable", label: ASSISTANT_CARD_WORDS.cannotUndoLabel }
      : { state: "available", label: ASSISTANT_CARD_WORDS.undoLabel },
  };
}
