import type { IconName } from "../Icon";

/** The colour of the icon in the card's tile. Defaults to `success`, as the boards draw a write that went through. */
export type AssistantActionCardIconTone = "success" | "secondary" | "muted";

/** Whether the food or recipe line was found in the database. */
export type AssistantActionCardMatch = "matched" | "unresolved";

type AssistantActionCardRowWords = {
  /** What was asked for or made, such as "2 tbsp olive oil". Drawn exactly as given. */
  name: string;
  /** The amount and where it came from, such as "2 large eggs (100 g) · 08:10". Drawn exactly as given: the card never reformats, rounds or converts an amount. */
  detail: string;
  /** The figure on the right, such as "144 kcal". */
  value?: string | undefined;
  /** The words of the Estimate badge, drawn beside the detail. Only a line whose amount was estimated sets it. */
  estimateLabel?: string | undefined;
};

/**
 * A row either says nothing about a match, or says which it is and gives the words for it. A `matched`
 * row draws a tick named by `matchLabel` (such as "Matched"). An `unresolved` row draws a warning badge
 * with `matchLabel` (such as "Not matched") and writes the detail in the warning ink.
 */
export type AssistantActionCardRow = AssistantActionCardRowWords &
  (
    | { match?: undefined; matchLabel?: undefined }
    | { match: AssistantActionCardMatch; matchLabel: string }
  );

/**
 * `available` is the Undo button. `busy` is the button while the undo runs, and it does nothing on a
 * press. `done` draws no action and mutes the title, because the card stays in the thread after an Undo.
 * `unavailable` draws the label as plain words, because the entries changed since.
 */
export type AssistantActionCardUndoState = "available" | "busy" | "done" | "unavailable";

export type AssistantActionCardUndo = {
  state: AssistantActionCardUndoState;
  /** "Undo" for `available` and `busy`, and "Can't undo" for `unavailable`. A `done` card draws no label. */
  label: string;
  onPress?: (() => void) | undefined;
};

export type AssistantActionCardProps = {
  icon: IconName;
  /** Defaults to `success`. */
  iconTone?: AssistantActionCardIconTone | undefined;
  /** What the assistant did, such as "Logged 2 eggs and toast at 08:10". */
  title: string;
  subtitle?: string | undefined;
  rows?: readonly AssistantActionCardRow[] | undefined;
  /** The line under the rows, such as "232 kcal · P 15 g · C 17 g · F 10 g". */
  total?: string | undefined;
  note?: string | undefined;
  /** A line under the card that opens what it made, such as "Open in recipe editor". It stays after an Undo. */
  link?: { label: string; onPress: () => void } | undefined;
  undo: AssistantActionCardUndo;
};
