import type { TurnResult } from "../src/types.ts";
import type { AssistantCard } from "@keylow/core";

export type StoredRow = Record<string, unknown>;

export const loggedCard: AssistantCard = {
  actionIds: ["33333333-3333-4333-8333-333333333333"],
  kind: "logged",
  title: "Title",
  sub: null,
  rows: [],
  totalText: null,
  note: null,
  link: null,
  undo: "available",
  undoneSub: null,
};

const toolUse = (id: string, name: string) => ({ type: "tool_use", id, name, input: {} });
const toolResult = (id: string) => ({ type: "tool_result", tool_use_id: id, content: "done" });

/**
 * The stored rows of a turn as the executor leaves them: the first refusal stores `askAgain` whatever else
 * landed, and a write stores its card. Core decides from these what the person sees.
 */
export const storedRows = (turn: TurnResult, wrote: boolean): StoredRow[] => [
  { id: "m1", turn_id: turn.turnId, seq: 1, role: "user", content: "Message", display: null },
  {
    id: "m2",
    turn_id: turn.turnId,
    seq: 2,
    role: "assistant",
    content: [
      ...(wrote ? [toolUse("log-1", "log_entry")] : []),
      toolUse("refused-1", "edit_routine"),
    ],
    display: null,
  },
  {
    id: "m3",
    turn_id: turn.turnId,
    seq: 3,
    role: "user",
    content: [...(wrote ? [toolResult("log-1")] : []), toolResult("refused-1")],
    display: {
      ...(wrote ? { "log-1": { card: loggedCard } } : {}),
      "refused-1": { askAgain: true },
    },
  },
  { id: "m4", turn_id: turn.turnId, seq: 4, role: "assistant", content: "Reply", display: null },
];
