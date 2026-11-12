import { assistantCardSchema } from "./card";
import { isTrainingCardKind } from "./cardPresentation";
import { hasTargetChanged } from "./undoState";
import {
  ASSISTANT_TOOLS_NEEDING_STORED_UNDO,
  ASSISTANT_TOOLS_WITHOUT_UNDO,
  ASSISTANT_WRITE_TOOL_CARD_KINDS,
  describeAssistantChange,
  isAssistantWriteTool,
  mergeAssistantCards,
} from "./writeToolWords";
import { CHANGED_IN_THE_APP_SINCE, CHANGED_SINCE } from "../copy/assistantTrainingCards";
import { describeDay } from "../dates/describeDay";
import { formatClockTime } from "../dates/formatClockTime";

import type { AssistantCard, AssistantCardKind } from "./card";
import type { AssistantActionState } from "./undoState";
import type {
  AssistantChangeInput,
  AssistantChangeTarget,
  AssistantChangeWords,
} from "./writeToolWords";

/*
 * "What the assistant changed" (`assistant-settings · changes`): the caller's `assistant_actions`, newest
 * first, one row per card the sheet drew, grouped by day.
 */

/** One `assistant_actions` row, with what its targets read now. */
export type AssistantChangeAction = AssistantActionState & {
  /** Null once the turn's conversation was deleted. */
  turnId: string | null;
  tool: string;
  /** The slot in the turn, which orders actions made in the same instant. */
  turnSeq: number;
  /** An ISO instant. */
  createdAt: string;
  /** `target_id` and `target_ids` together. */
  targetIds: readonly string[];
};

/**
 * What the list keeps of a training card stored with its turn: the words it needs and nothing else. The
 * stored `display` also holds the value Undo puts back, which is a person's own data and never leaves the
 * read, so the rest of the card (its rows and notes too) is dropped here.
 */
export type AssistantChangeStoredCard = Pick<
  AssistantCard,
  "actionIds" | "kind" | "title" | "sub" | "link" | "changeDetail"
>;

export type AssistantChangeState = "undo" | "undone" | "cant_undo";

export type AssistantChangeRow = {
  key: string;
  actionIds: string[];
  title: string;
  sub: string | null;
  state: AssistantChangeState;
  /**
   * Present on the row of a training write only. `changedSinceDetail` is what its sub reads once a press
   * of Undo says the person changed the item since, which the list cannot know until then (no training
   * table has a change time).
   */
  training?: { kind: AssistantCardKind; changedSinceDetail: string };
};

export type AssistantChangeDay = { label: string; rows: AssistantChangeRow[] };

export type AssistantChanges = { days: AssistantChangeDay[]; count: number };

export type AssistantChangesOptions = {
  now: Date;
  /** The person's IANA time zone, which gives the days and the times. */
  timeZone: string;
  /** The rows the actions changed, by id. */
  targets: readonly AssistantChangeTarget[];
  describeChange?: (input: AssistantChangeInput) => AssistantChangeWords;
  /** The training cards stored with the turns of the actions, read through `assistantChangeCardsOfDisplay`. */
  cards?: readonly AssistantChangeStoredCard[];
};

const CHANGED_SINCE_WORDS = "changed in your diary since";

/**
 * After a conversation is deleted its actions have no turn, so writes of one tool made within this long
 * of the card's newest write are one card. The turn's ten slots also cap a card at ten writes.
 */
const SAME_CARD_GAP_MILLISECONDS = 60_000;
const MOST_WRITES_IN_A_CARD = 10;

const SUB_SEPARATOR = " · ";

/** The sub line of a row: the time, then the fact when there is one. */
export const describeChangeSub = (time: string, detail: string | null): string =>
  detail === null ? time : `${time}${SUB_SEPARATOR}${detail}`;

/** The time at the start of a row's sub line, which `describeChangeSub` put there. */
export const timeOfChangeSub = (sub: string | null): string | null =>
  sub === null ? null : (sub.split(SUB_SEPARATOR)[0] ?? null);

/**
 * The cards of a message's `display`, keeping the training ones and only the words the list needs. A card
 * that does not parse is dropped, so a row falls back to the plain words, and no part of `display` that
 * is not a card is read, which is where the value Undo puts back is kept.
 */
export function assistantChangeCardsOfDisplay(display: unknown): AssistantChangeStoredCard[] {
  if (typeof display !== "object" || display === null || Array.isArray(display)) {
    return [];
  }
  return Object.values(display).flatMap((entry: unknown): AssistantChangeStoredCard[] => {
    const card =
      typeof entry === "object" && entry !== null && "card" in entry
        ? assistantCardSchema.safeParse(entry.card)
        : null;
    if (card === null || !card.success || !isTrainingCardKind(card.data.kind)) {
      return [];
    }
    const { actionIds, kind, title, sub, link, changeDetail } = card.data;
    return [{ actionIds, kind, title, sub, link, changeDetail }];
  });
}

/** True for the writes of training, which the list words from the card their turn stored. */
export const isTrainingWriteTool = (tool: string): boolean =>
  isAssistantWriteTool(tool) && isTrainingCardKind(ASSISTANT_WRITE_TOOL_CARD_KINDS[tool]);

const instantOf = (action: AssistantChangeAction): number => Date.parse(action.createdAt);

// `group` is newest first, so its first action anchors the window.
function belongsToGroup(group: readonly AssistantChangeAction[], older: AssistantChangeAction) {
  const [newest] = group;
  if (newest === undefined) {
    return false;
  }
  if (group.length >= MOST_WRITES_IN_A_CARD || newest.tool !== older.tool) {
    return false;
  }
  if (newest.turnId !== null || older.turnId !== null) {
    return newest.turnId === older.turnId;
  }
  return instantOf(newest) - instantOf(older) <= SAME_CARD_GAP_MILLISECONDS;
}

/** Newest first, with the actions of one card together. Each group is newest first as well. */
function groupActions(actions: readonly AssistantChangeAction[]): AssistantChangeAction[][] {
  const groups: AssistantChangeAction[][] = [];
  const newestFirst = [...actions].sort(
    (a, b) => instantOf(b) - instantOf(a) || b.turnSeq - a.turnSeq,
  );
  for (const action of newestFirst) {
    const group = groups.at(-1);
    if (group !== undefined && belongsToGroup(group, action)) {
      group.push(action);
    } else {
      groups.push([action]);
    }
  }
  return groups;
}

function stateOfGroup(group: readonly AssistantChangeAction[]): AssistantChangeState {
  if (group.every((action) => action.undoneAt !== null)) {
    return "undone";
  }
  const open = group.filter((action) => action.undoneAt === null);
  return open.some(
    (action) =>
      ASSISTANT_TOOLS_WITHOUT_UNDO.has(action.tool) ||
      !action.hasTarget ||
      hasTargetChanged(action) ||
      // The turn that stored the value Undo puts back is gone with its conversation.
      (action.turnId === null && ASSISTANT_TOOLS_NEEDING_STORED_UNDO.has(action.tool)),
  )
    ? "cant_undo"
    : "undo";
}

const fullCardOf = (stored: AssistantChangeStoredCard): AssistantCard => ({
  ...stored,
  rows: [],
  days: null,
  totalText: null,
  note: null,
  undo: "available",
  undoneSub: null,
});

// The card of a training group, one stored card for each write in call order, merged as the thread merges
// them. A write whose card is gone (its conversation was deleted) leaves the group with none, and then the
// row is worded plainly.
function mergedCardOfGroup(
  oldestFirst: readonly AssistantChangeAction[],
  cardsByActionId: ReadonlyMap<string, AssistantChangeStoredCard>,
): AssistantCard | null {
  const stored = oldestFirst.map((action) => cardsByActionId.get(action.id));
  const found = stored.filter((card) => card !== undefined);
  const [first, ...others] = [...new Set(found)].map(fullCardOf);
  return found.length !== stored.length || first === undefined
    ? null
    : mergeAssistantCards([first, ...others]);
}

export function assistantChangesFromActions(
  actions: readonly AssistantChangeAction[],
  {
    now,
    timeZone,
    targets,
    describeChange = describeAssistantChange,
    cards = [],
  }: AssistantChangesOptions,
): AssistantChanges {
  const days: AssistantChangeDay[] = [];
  let count = 0;
  const cardsByActionId = new Map(
    cards
      .filter((card) => isTrainingCardKind(card.kind))
      .flatMap((card) => card.actionIds.map((id) => [id, card] as const)),
  );

  for (const group of groupActions(actions)) {
    const [newest] = group;
    if (newest === undefined) {
      continue;
    }
    const oldestFirst = [...group].reverse();
    const targetIds = new Set(oldestFirst.flatMap((action) => action.targetIds));
    const plainWords = describeChange({
      tool: newest.tool,
      actionCount: group.length,
      targets: targets.filter((target) => targetIds.has(target.id)),
    });
    // A training write is worded from the card its turn stored, which knows what the write did.
    const toolKind = isAssistantWriteTool(newest.tool)
      ? ASSISTANT_WRITE_TOOL_CARD_KINDS[newest.tool]
      : null;
    const isTraining = toolKind !== null && isTrainingCardKind(toolKind);
    const card = isTraining ? mergedCardOfGroup(oldestFirst, cardsByActionId) : null;
    const words =
      card === null ? plainWords : { title: card.title, detail: card.changeDetail ?? null };
    const state = stateOfGroup(group);
    const changedByThePerson = state === "cant_undo" && group.some(hasTargetChanged);
    const detail = changedByThePerson ? CHANGED_SINCE_WORDS : words.detail;
    const instant = new Date(newest.createdAt);
    const time = formatClockTime(instant, timeZone);
    const trainingKind = isTraining ? (card?.kind ?? toolKind) : null;
    const row: AssistantChangeRow = {
      key: oldestFirst[0]?.id ?? newest.id,
      actionIds: oldestFirst.map((action) => action.id),
      title: words.title,
      sub: describeChangeSub(time, detail),
      state,
      ...(trainingKind === null
        ? {}
        : {
            training: {
              kind: trainingKind,
              changedSinceDetail: trainingKind.startsWith("exercise_")
                ? CHANGED_SINCE
                : CHANGED_IN_THE_APP_SINCE,
            },
          }),
    };

    // A write dated after "now" (a clock a little ahead) is today's, never a day to come.
    const described = describeDay(instant, now, timeZone);
    const label =
      described.daysFromToday > 0 ? describeDay(now, now, timeZone).label : described.label;
    const day = days.at(-1);
    if (day?.label === label) {
      day.rows.push(row);
    } else {
      days.push({ label, rows: [row] });
    }
    count += 1;
  }

  return { days, count };
}
