import type { AssistantCard, AssistantCardKind } from "./card";

/*
 * The words a write tool gives to something the app builds from several writes at once: a card that
 * merges consecutive calls of one tool in a turn, and a row of "What the assistant changed". Each write
 * ticket (KEY-688, 693, 694, 697, 698) adds one line for its tool to `changeBuilders` and, when the board
 * words a merge, one line for its kind to `cardMergers`. Until it does, a tool falls back to the plain
 * words here, so a row or a merged card always has a title and never shows an id.
 *
 * A builder gets `row`s as the target table's read returns them, untyped, so it parses each with its own
 * schema and words a row it cannot parse plainly. All the targets of a multi-row action share the one
 * `target_updated_at` the write recorded.
 */

/** Every write tool, with the kind of card it builds. */
export const ASSISTANT_WRITE_TOOL_CARD_KINDS = {
  log_entry: "logged",
  update_entry: "updated",
  delete_entry: "deleted",
  copy_day: "day_copied",
  set_day_complete: "day_completed",
  create_recipe: "recipe_created",
  update_recipe: "recipe_updated",
  archive_recipe: "recipe_archived",
  create_custom_food: "food_created",
  update_targets: "targets_changed",
} as const satisfies Record<string, AssistantCardKind>;

export type AssistantWriteTool = keyof typeof ASSISTANT_WRITE_TOOL_CARD_KINDS;

export const isAssistantWriteTool = (tool: string): tool is AssistantWriteTool =>
  Object.hasOwn(ASSISTANT_WRITE_TOOL_CARD_KINDS, tool);

/**
 * The write tools whose Undo is off in M8 (ADR 0006, Guards): an edit keeps no previous value to go
 * back to. The thread and the changes list both read this one set.
 */
export const ASSISTANT_TOOLS_WITHOUT_UNDO: ReadonlySet<string> = new Set([
  "update_entry",
  "update_recipe",
]);

/** The kinds of card those tools build. */
export const ASSISTANT_CARD_KINDS_WITHOUT_UNDO: ReadonlySet<AssistantCardKind> = new Set(
  [...ASSISTANT_TOOLS_WITHOUT_UNDO].flatMap((tool) =>
    isAssistantWriteTool(tool) ? [ASSISTANT_WRITE_TOOL_CARD_KINDS[tool]] : [],
  ),
);

/**
 * A row a write changed, as the person's own read of the target table returns it. `row` is null when it
 * no longer exists, and then a builder words the change plainly.
 */
export type AssistantChangeTarget = { id: string; row: Readonly<Record<string, unknown>> | null };

/**
 * What a row of the changes list is worded from: the tool, how many of its writes the row groups, and
 * the target rows those writes left behind.
 */
export type AssistantChangeInput = {
  tool: string;
  actionCount: number;
  targets: readonly AssistantChangeTarget[];
};

/** `detail` is the part of the row's second line after the time ("2 entries"), or null. */
export type AssistantChangeWords = { title: string; detail: string | null };

type AssistantChangeBuilder = (input: AssistantChangeInput) => AssistantChangeWords;

type AssistantCardMerger = (cards: readonly AssistantCard[]) => AssistantCard;

// A write ticket adds its tool here, with the board's words for its rows.
const changeBuilders: Readonly<Partial<Record<AssistantWriteTool, AssistantChangeBuilder>>> = {
  // log_entry: describeLoggedEntries,
};

// A write ticket adds its kind here when the board words several calls as one card.
const cardMergers: Readonly<Partial<Record<AssistantCardKind, AssistantCardMerger>>> = {
  // logged: mergeLoggedCards,
};

const entries = (count: number): string => (count === 1 ? "1 entry" : `${count} entries`);

const plainTitles: Record<AssistantCardKind, (count: number) => string> = {
  logged: (count) => `Logged ${entries(count)}`,
  updated: (count) => `Updated ${entries(count)}`,
  deleted: (count) => `Deleted ${entries(count)}`,
  day_copied: () => "Copied a day",
  day_completed: () => "Marked a day complete",
  recipe_created: () => "Added a recipe",
  recipe_updated: () => "Updated a recipe",
  recipe_archived: () => "Archived a recipe",
  food_created: () => "Added a food",
  targets_changed: () => "Changed your targets",
};

/** The title and detail of one row of "What the assistant changed". */
export function describeAssistantChange(input: AssistantChangeInput): AssistantChangeWords {
  if (!isAssistantWriteTool(input.tool)) {
    return { title: "Made a change", detail: null };
  }
  const build = changeBuilders[input.tool];
  if (build !== undefined) {
    return build(input);
  }
  const kind = ASSISTANT_WRITE_TOOL_CARD_KINDS[input.tool];
  return { title: plainTitles[kind](input.actionCount), detail: null };
}

/**
 * One card from the cards of consecutive results of one tool in a turn, in call order. The action ids are
 * joined and the rows appended. Without the write's own merger the lines that described a single call
 * (the sub, the total, the note, the link and the undone line) are dropped and the title is plain, so a
 * merged card is never worded wrongly.
 */
export function mergeAssistantCards(
  cards: readonly [AssistantCard, ...AssistantCard[]],
): AssistantCard {
  const [first, ...others] = cards;
  if (others.length === 0) {
    return first;
  }
  const merge = cardMergers[first.kind];
  if (merge !== undefined) {
    return merge(cards);
  }
  const actionIds = cards.flatMap((card) => card.actionIds);
  return {
    ...first,
    actionIds,
    title: plainTitles[first.kind](actionIds.length),
    sub: null,
    rows: cards.flatMap((card) => card.rows),
    totalText: null,
    note: null,
    link: null,
    undoneSub: null,
  };
}
