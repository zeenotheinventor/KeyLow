import { ASSISTANT_CONSENT_VERSION } from "@keylow/core";
import { createClient } from "@supabase/supabase-js";

import {
  CONVERSATION_ID as STORED_CONVERSATION_ID,
  FIRST_TURN_ID,
} from "../../../../packages/api-client/test/support/assistantFake";
import {
  replyEvents,
  turnResponse,
} from "../../../../packages/api-client/test/support/assistantStream";

export const FUNCTIONS_URL = "http://localhost:54321/functions/v1";
const USER_ID = "11111111-1111-4111-8111-111111111111";

type StoredMessage = {
  id: string;
  turn_id: string;
  role: "user" | "assistant";
  content: unknown;
  display: null;
};

/*
 * The backend as the panel's real Supabase client and the global `fetch` meet it. One function answers
 * every request, so what the panel sends is what a test reads, not what a hook was called with. The stream
 * of the turn route is the api-client's own test fake.
 */
export const panelBackend = {
  isConsentGiven: true,
  timeZone: "Europe/London",
  /** The newest conversation's stored turns, which a test sets to start the panel on a conversation. */
  storedTurns: [] as Array<{ userText: string; assistantText: string }>,
  consentWriteFails: false,
  /** How the turn route answers. A test swaps it to hold a stream open. */
  answerTurn: (): Response => turnResponse(replyEvents("Hello ", "there")),
  turnRequests: [] as Array<{ text: string; localDate: string }>,
  newConversationRequests: 0,
  statusRequests: 0,
  /** Holds the status route until it settles, so a test sees the panel while it is read. */
  statusGate: null as Promise<void> | null,
};

export function resetPanelBackend() {
  panelBackend.isConsentGiven = true;
  panelBackend.timeZone = "Europe/London";
  panelBackend.storedTurns = [];
  panelBackend.consentWriteFails = false;
  panelBackend.answerTurn = () => turnResponse(replyEvents("Hello ", "there"));
  panelBackend.turnRequests = [];
  panelBackend.newConversationRequests = 0;
  panelBackend.statusRequests = 0;
  panelBackend.statusGate = null;
}

// A body that stops with an AbortError when the request's signal aborts, as the browser's `fetch` does.
function endsWhenAborted(response: Response, signal: AbortSignal): Response {
  const reader = response.body?.getReader();
  if (reader === undefined) {
    return response;
  }
  const aborted = new Promise<never>((_resolve, reject) => {
    signal.addEventListener("abort", () => {
      reject(new DOMException("The operation was aborted.", "AbortError"));
    });
  });
  aborted.catch(() => undefined);
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await Promise.race([reader.read(), aborted]);
        if (done) {
          controller.close();
        } else {
          controller.enqueue(value);
        }
      } catch (error) {
        controller.error(error);
      }
    },
  });
  return new Response(body, { headers: response.headers });
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/** One row for a read that asks for one object, and the rows otherwise, as PostgREST answers. */
function answerRows(request: Request, rows: unknown[]): Response {
  if (request.headers.get("accept")?.includes("vnd.pgrst.object") !== true) {
    return json(rows);
  }
  const [row] = rows;
  return row === undefined
    ? json({ code: "PGRST116", message: "no row", details: null, hint: null }, 406)
    : json(row);
}

const storedTurnRows = () =>
  panelBackend.storedTurns.map(({ userText, assistantText }, index) => {
    const id = index === 0 ? FIRST_TURN_ID : `00000000-0000-4000-8000-0000000000a${index + 1}`;
    const messages: StoredMessage[] = [
      {
        id: `user-${index}`,
        turn_id: id,
        role: "user",
        content: [
          { type: "text", text: "Today is Tue 27 Oct." },
          { type: "text", text: userText },
        ],
        display: null,
      },
      {
        id: `assistant-${index}`,
        turn_id: id,
        role: "assistant",
        content: [{ type: "text", text: assistantText }],
        display: null,
      },
    ];
    return {
      id,
      status: "complete",
      created_at: `2026-10-27T0${index + 8}:00:00Z`,
      assistant_messages: messages.map((message, position) => ({
        ...message,
        conversation_id: STORED_CONVERSATION_ID,
        seq: index * 2 + position + 1,
      })),
    };
  });

async function fakeFetch(input: string | URL | globalThis.Request, init?: RequestInit) {
  const request = new globalThis.Request(input, init);
  const { pathname, searchParams } = new URL(request.url);

  if (pathname.endsWith("/auth/v1/user")) {
    return json({ id: USER_ID, aud: "authenticated", role: "authenticated" });
  }
  if (pathname.endsWith("/assistant/status")) {
    panelBackend.statusRequests += 1;
    await panelBackend.statusGate;
    return json({ notice: panelBackend.isConsentGiven ? null : { code: "consent_needed" } });
  }
  if (pathname.endsWith("/assistant/turn")) {
    const body: unknown = await request.json();
    const text =
      typeof body === "object" && body !== null && "text" in body ? String(body.text) : "";
    const localDate =
      typeof body === "object" && body !== null && "localDate" in body
        ? String(body.localDate)
        : "";
    panelBackend.turnRequests.push({ text, localDate });
    return endsWhenAborted(panelBackend.answerTurn(), request.signal);
  }
  if (pathname.endsWith("/assistant/conversations")) {
    panelBackend.newConversationRequests += 1;
    panelBackend.storedTurns = [];
    return json({ conversationId: "00000000-0000-4000-8000-0000000000b2" });
  }
  if (pathname.endsWith("/profiles") && request.method === "GET") {
    return searchParams.get("select") === "timezone"
      ? answerRows(request, [{ timezone: panelBackend.timeZone }])
      : answerRows(request, [
          {
            assistant_consent_at: panelBackend.isConsentGiven ? "2026-11-12T10:00:00Z" : null,
            assistant_consent_version: panelBackend.isConsentGiven
              ? ASSISTANT_CONSENT_VERSION
              : null,
          },
        ]);
  }
  if (pathname.endsWith("/profiles") && request.method === "PATCH") {
    if (panelBackend.consentWriteFails) {
      return json(
        { code: "XX000", message: "database unavailable", details: null, hint: null },
        500,
      );
    }
    panelBackend.isConsentGiven = true;
    return json([{ id: USER_ID }]);
  }
  if (pathname.endsWith("/assistant_conversations")) {
    return answerRows(
      request,
      panelBackend.storedTurns.length === 0 ? [] : [{ id: STORED_CONVERSATION_ID }],
    );
  }
  if (pathname.endsWith("/assistant_turns")) {
    const isOlderPage = searchParams.has("or");
    return answerRows(request, isOlderPage ? [] : storedTurnRows());
  }
  if (pathname.endsWith("/assistant_actions") || pathname.endsWith("/assistant_messages")) {
    return answerRows(request, []);
  }
  return json({ message: "unexpected request" }, 404);
}

export { fakeFetch as panelFetch };

export const panelClient = createClient("http://localhost:54321", "anon-key", {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: fakeFetch },
});

const encodeSegment = (value: object) =>
  btoa(JSON.stringify(value)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");

export async function signInPanelClient() {
  const accessToken = [
    encodeSegment({ alg: "HS256", typ: "JWT" }),
    encodeSegment({
      sub: USER_ID,
      role: "authenticated",
      aud: "authenticated",
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
    encodeSegment({ note: "unsigned" }),
  ].join(".");
  await panelClient.auth.setSession({ access_token: accessToken, refresh_token: "test-refresh" });
}
