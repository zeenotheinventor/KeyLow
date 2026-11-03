import { ASSISTANT_CARD_WORDS } from "../copy/assistantNotices";
import { ASSISTANT_CARD_NOTES } from "../copy/assistantSheet";

import type { AssistantCard, AssistantCardKind, AssistantCardLink, AssistantCardRow } from "./card";

/*
 * What the action card draws for a card the assistant sent: the icon of its kind, its words as sent and
 * the state of its Undo. The sheet draws what this returns and decides nothing itself. A card's strings
 * are worded by the write that made it and are passed through unchanged, so nothing here builds, rounds or
 * converts an amount.
 */

/** The icons the boards draw on a card, by their names in the app's icon set. */
export type AssistantCardIconName =
  "Check" | "Copy" | "ChefHat" | "Trash2" | "Apple" | "Target" | "RotateCcw";

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
};

/**
 * `available` is the Undo button, `unavailable` the plain words Can't undo, and `done` draws no action.
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
  total: string | null;
  note: string | null;
  link: AssistantCardLink | null;
  undo: AssistantCardUndoLook;
};

/** What the person's own Undo came to, for a card that was sent as available. */
export type AssistantCardUndoOutcome = "undone" | "unavailable";

/** One code of the undo route's answer for each action id. */
export type AssistantUndoCode = "undone" | "already_undone" | "undo_unavailable" | "not_found";

/**
 * What a card's Undo came to: undone once every action is (already undone counts, someone got there
 * first), otherwise unavailable, whether an action's entries changed or were not found.
 */
export function undoOutcomeOfResults(
  results: readonly AssistantUndoCode[],
): AssistantCardUndoOutcome {
  return results.length > 0 &&
    results.every((result) => result === "undone" || result === "already_undone")
    ? "undone"
    : "unavailable";
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

/**
 * The card as the sheet draws it. `outcome` is what an Undo pressed on this card came to, which is
 * the card's state until the thread is read again, and only for a card that was sent as available.
 */
export function describeAssistantCard(
  card: AssistantCard,
  outcome: AssistantCardUndoOutcome | null = null,
): AssistantCardLook {
  const undo = card.undo === "available" && outcome !== null ? outcome : card.undo;

  if (undo === "undone") {
    return {
      icon: "RotateCcw",
      iconTone: "muted",
      title: ASSISTANT_CARD_WORDS.undoneTitle,
      subtitle: card.undoneSub,
      rows: [],
      total: null,
      note: null,
      link: card.link !== null && isLinkToDiary(card.link) ? card.link : null,
      undo: { state: "done", label: ASSISTANT_CARD_WORDS.undoneTitle },
    };
  }

  const { icon, tone } = kindLooks[card.kind];
  const isUnavailable = undo === "unavailable";

  return {
    icon,
    iconTone: tone,
    title: card.title,
    subtitle: card.sub,
    rows: card.rows.map(describeRow),
    total: card.totalText,
    note:
      card.note ??
      (isUnavailable && KINDS_OF_DIARY_ENTRIES.has(card.kind)
        ? ASSISTANT_CARD_NOTES.entriesChanged
        : null),
    link: card.link,
    undo: isUnavailable
      ? { state: "unavailable", label: ASSISTANT_CARD_WORDS.cannotUndoLabel }
      : { state: "available", label: ASSISTANT_CARD_WORDS.undoLabel },
  };
}
