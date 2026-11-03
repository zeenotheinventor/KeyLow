import { hasTargetChanged } from "./undoState";
import { ASSISTANT_TOOLS_WITHOUT_UNDO, describeAssistantChange } from "./writeToolWords";
import { describeDay } from "../dates/describeDay";
import { formatClockTime } from "../dates/formatClockTime";

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

export type AssistantChangeState = "undo" | "undone" | "cant_undo";

export type AssistantChangeRow = {
  key: string;
  actionIds: string[];
  title: string;
  sub: string | null;
  state: AssistantChangeState;
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
};

const CHANGED_SINCE_WORDS = "changed in your diary since";

/**
 * After a conversation is deleted its actions have no turn, so writes of one tool made within this long
 * of the card's newest write are one card. The turn's ten slots also cap a card at ten writes.
 */
const SAME_CARD_GAP_MILLISECONDS = 60_000;
const MOST_WRITES_IN_A_CARD = 10;

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
      hasTargetChanged(action),
  )
    ? "cant_undo"
    : "undo";
}

export function assistantChangesFromActions(
  actions: readonly AssistantChangeAction[],
  { now, timeZone, targets, describeChange = describeAssistantChange }: AssistantChangesOptions,
): AssistantChanges {
  const days: AssistantChangeDay[] = [];
  let count = 0;

  for (const group of groupActions(actions)) {
    const [newest] = group;
    if (newest === undefined) {
      continue;
    }
    const oldestFirst = [...group].reverse();
    const targetIds = new Set(oldestFirst.flatMap((action) => action.targetIds));
    const words = describeChange({
      tool: newest.tool,
      actionCount: group.length,
      targets: targets.filter((target) => targetIds.has(target.id)),
    });
    const state = stateOfGroup(group);
    const changedByThePerson = state === "cant_undo" && group.some(hasTargetChanged);
    const detail = changedByThePerson ? CHANGED_SINCE_WORDS : words.detail;
    const instant = new Date(newest.createdAt);
    const time = formatClockTime(instant, timeZone);
    const row: AssistantChangeRow = {
      key: oldestFirst[0]?.id ?? newest.id,
      actionIds: oldestFirst.map((action) => action.id),
      title: words.title,
      sub: detail === null ? time : `${time} · ${detail}`,
      state,
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
