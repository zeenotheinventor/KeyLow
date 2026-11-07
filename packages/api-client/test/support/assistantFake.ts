import { HttpResponse, http } from "msw";

import { REST_URL, postgrestError, postgrestRows } from "./postgrest";

import type { SetupServer } from "msw/node";

export const FUNCTIONS_URL = "http://127.0.0.1:54321/functions/v1/assistant";

export const FIRST_TURN_ID = "00000000-0000-4000-8000-0000000000a1";
export const SECOND_TURN_ID = "00000000-0000-4000-8000-0000000000a2";
export const FIRST_ACTION_ID = "00000000-0000-4000-8000-0000000000d1";
export const SECOND_ACTION_ID = "00000000-0000-4000-8000-0000000000d2";

export const CONVERSATION_ID = "00000000-0000-4000-8000-0000000000b1";
export const NEW_CONVERSATION_ID = "00000000-0000-4000-8000-0000000000b2";

type ActionFakeRow = {
  id: string;
  conversation_id: string | null;
  turn_id: string | null;
  turn_seq: number;
  tool: string;
  target_table: string;
  target_id: string | null;
  target_ids: string[] | null;
  target_local_date: string | null;
  target_updated_at: string | null;
  created_at: string;
  undone_at: string | null;
};

export const actionRow = (overrides: Partial<ActionFakeRow> = {}): ActionFakeRow => ({
  id: FIRST_ACTION_ID,
  conversation_id: CONVERSATION_ID,
  turn_id: FIRST_TURN_ID,
  turn_seq: 1,
  tool: "log_entry",
  // A table with no target source, so the thread and the changes list read no target rows for these.
  target_table: "unmapped_table",
  target_id: "00000000-0000-4000-8000-0000000000f1",
  target_ids: null,
  target_local_date: null,
  target_updated_at: null,
  created_at: "2026-10-27T08:11:00Z",
  undone_at: null,
  ...overrides,
});

const loggedCard = {
  actionIds: [FIRST_ACTION_ID, SECOND_ACTION_ID],
  kind: "logged",
  title: "Logged 2 eggs and toast at 08:10",
  sub: null,
  rows: [],
  totalText: "232 kcal · P 15 g · C 17 g · F 10 g",
  note: null,
  link: null,
  undo: "available",
  undoneSub: "Removed 2 eggs and toast from 08:10",
};

const wrapped = (source: string, outcome: unknown) =>
  `<untrusted_data source="${source}">${JSON.stringify(outcome)}</untrusted_data>`;

// `assistant · conversation`: the eggs and toast with their card, then a question and its answer.
const messageRows = [
  {
    id: "m1",
    turn_id: FIRST_TURN_ID,
    role: "user",
    content: [
      { type: "text", text: "Today is Tue 27 Oct." },
      { type: "text", text: "2 eggs and toast at 8:10" },
    ],
  },
  {
    id: "m2",
    turn_id: FIRST_TURN_ID,
    role: "assistant",
    content: [{ type: "tool_use", id: "call-1", name: "log_entry", input: {} }],
  },
  {
    id: "m3",
    turn_id: FIRST_TURN_ID,
    role: "user",
    content: [
      {
        type: "tool_result",
        tool_use_id: "call-1",
        content: wrapped("log_entry", { status: "done" }),
      },
    ],
    display: { "call-1": { card: loggedCard } },
  },
  {
    id: "m4",
    turn_id: SECOND_TURN_ID,
    role: "user",
    content: [{ type: "text", text: "What's left for today?" }],
  },
  {
    id: "m5",
    turn_id: SECOND_TURN_ID,
    role: "assistant",
    content: [{ type: "text", text: "You have 1,693 kcal left today." }],
  },
].map((row, index) => ({
  display: null,
  ...row,
  conversation_id: CONVERSATION_ID,
  seq: index + 1,
}));

export type MessageFakeRow = (typeof messageRows)[number];
export type TurnFakeRow = { id: string; status: string };

const defaultTurns: TurnFakeRow[] = [
  { id: FIRST_TURN_ID, status: "complete" },
  { id: SECOND_TURN_ID, status: "complete" },
];

/** The most rows a PostgREST request returns, which the stack sets with `max_rows`. */
const MAX_ROWS = 1000;

/** The page of `rows` a request asks for with `offset` and `limit`, cut at `MAX_ROWS` as the API does. */
function pageOf<Row>(request: Request, rows: readonly Row[]): Row[] {
  const { searchParams } = new URL(request.url);
  const offset = Number(searchParams.get("offset") ?? 0);
  const limit = Math.min(Number(searchParams.get("limit") ?? MAX_ROWS), MAX_ROWS);
  return rows.slice(offset, offset + limit);
}

export type AssistantFakeState = {
  /** The conversations, newest first. */
  conversationIds: string[];
  /** The newest conversation's messages, in `seq` order. */
  messages: MessageFakeRow[];
  turns: TurnFakeRow[];
  actions: ActionFakeRow[];
  timeZone: string | null;
  /** What the undo route answers for each action id. */
  undoResults: Record<string, string>;
  /** The reason the undo route gives for an action id it refused, for the ids listed. */
  undoReasons: Record<string, string>;
  /** The bodies the undo route was sent. */
  undoBodies: unknown[];
  conversationRequests: number;
  deletedAllConversations: number;
  /** The query string of the delete, which PostgREST needs to carry a filter. */
  deleteQuery: string | null;
  /** The `order` and `limit` the conversation read was sent. */
  conversationRead: URLSearchParams | null;
};

export const createAssistantFakeState = (
  overrides: Partial<AssistantFakeState> = {},
): AssistantFakeState => ({
  conversationIds: [CONVERSATION_ID],
  messages: messageRows,
  turns: defaultTurns,
  actions: [FIRST_ACTION_ID, SECOND_ACTION_ID].map((id, index) =>
    actionRow({ id, turn_seq: index + 1 }),
  ),
  timeZone: "Europe/London",
  undoResults: {},
  undoReasons: {},
  undoBodies: [],
  conversationRequests: 0,
  deletedAllConversations: 0,
  deleteQuery: null,
  conversationRead: null,
  ...overrides,
});

/** Answers the assistant's reads and routes from `state`, which the handlers also update. */
export function installAssistantFake(server: SetupServer, state: AssistantFakeState) {
  server.use(
    http.get(`${REST_URL}/assistant_conversations`, ({ request }) => {
      state.conversationRead = new URL(request.url).searchParams;
      const [newest] = state.conversationIds;
      return postgrestRows(request, newest === undefined ? [] : [{ id: newest }]);
    }),
    http.delete(`${REST_URL}/assistant_conversations`, ({ request }) => {
      state.deleteQuery = new URL(request.url).search;
      state.deletedAllConversations += 1;
      state.conversationIds = [];
      return new HttpResponse(null, { status: 204 });
    }),
    http.get(`${REST_URL}/assistant_messages`, ({ request }) => {
      const conversationId = new URL(request.url).searchParams.get("conversation_id");
      return postgrestRows(
        request,
        conversationId === `eq.${CONVERSATION_ID}` ? pageOf(request, state.messages) : [],
      );
    }),
    http.get(`${REST_URL}/assistant_turns`, ({ request }) =>
      postgrestRows(request, pageOf(request, state.turns)),
    ),
    http.get(`${REST_URL}/assistant_actions`, ({ request }) => {
      const conversationId = new URL(request.url).searchParams.get("conversation_id");
      const rows =
        conversationId === null
          ? state.actions
          : state.actions.filter((row) => conversationId === `eq.${row.conversation_id}`);
      return postgrestRows(request, pageOf(request, rows));
    }),
    http.get(`${REST_URL}/profiles`, ({ request }) =>
      state.timeZone === null
        ? postgrestRows(request, [])
        : postgrestRows(request, [{ timezone: state.timeZone }]),
    ),
    http.post(`${FUNCTIONS_URL}/conversations`, () => {
      state.conversationRequests += 1;
      state.conversationIds = [NEW_CONVERSATION_ID, ...state.conversationIds];
      return HttpResponse.json({ conversationId: NEW_CONVERSATION_ID });
    }),
    http.post(`${FUNCTIONS_URL}/undo`, async ({ request }) => {
      const body: unknown = await request.json();
      state.undoBodies.push(body);
      const actionIds =
        typeof body === "object" &&
        body !== null &&
        "actionIds" in body &&
        Array.isArray(body.actionIds)
          ? body.actionIds
          : [];
      return HttpResponse.json({
        results: actionIds.map((actionId: unknown) => ({
          actionId,
          result:
            typeof actionId === "string" ? (state.undoResults[actionId] ?? "undone") : "not_found",
          ...(typeof actionId === "string" && state.undoReasons[actionId] !== undefined
            ? { reason: state.undoReasons[actionId] }
            : {}),
        })),
      });
    }),
  );
}

export { postgrestError };
