import { createServer } from "node:http";
import { text } from "node:stream/consumers";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createHttpDriver } from "../src/httpDriver.ts";

import type { HttpDriverOptions } from "../src/httpDriver.ts";
import type { ToolCall } from "../src/types.ts";
import type { IncomingMessage, Server, ServerResponse } from "node:http";

// A stub of the served `assistant` function: a real HTTP server that answers `POST /functions/v1/assistant/turn`
// with the stream a test sets, and keeps the request it received. No model, no database, no stack.

const TURN_ID = "11111111-1111-4111-8111-111111111111";
const CONVERSATION_ID = "22222222-2222-4222-8222-222222222222";

const sse = (event: Record<string, unknown>) => `data: ${JSON.stringify(event)}\n\n`;
const turnEvent = sse({ type: "turn", turnId: TURN_ID, conversationId: CONVERSATION_ID });

type Received = { path: string; headers: IncomingMessage["headers"]; body: unknown };

let server: Server;
let baseUrl: string;
let received: Received[] = [];
let answer: (response: ServerResponse) => void = () => undefined;

beforeAll(async () => {
  server = createServer((request, response) => {
    void text(request).then((body) => {
      const parsed: unknown = JSON.parse(body);
      received.push({ path: request.url ?? "", headers: request.headers, body: parsed });
      answer(response);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${typeof address === "object" && address !== null ? address.port : 0}`;
});

afterAll(async () => {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
});

const streamOf = (...blocks: string[]) => {
  answer = (response) => {
    response.writeHead(200, { "Content-Type": "text/event-stream" });
    response.end(blocks.join(""));
  };
};

function driver(overrides: Partial<HttpDriverOptions> = {}) {
  received = [];
  return createHttpDriver({
    apiUrl: baseUrl,
    anonKey: "anon-key-for-tests",
    getAccessToken: () => Promise.resolve("token-for-tests"),
    timeZone: "UTC",
    now: () => new Date("2026-11-03T12:00:00Z"),
    readToolCalls: () => Promise.resolve([]),
    ...overrides,
  });
}

describe("createHttpDriver, cards", () => {
  const card = {
    actionIds: ["33333333-3333-4333-8333-333333333333"],
    kind: "recipe_created",
    title: "Added recipe Test, 2 servings",
    sub: null,
    rows: [],
    totalText: null,
    note: null,
    link: null,
    undo: "available",
    undoneSub: null,
  };

  it("should keep the cards a turn sent, in order", async () => {
    streamOf(
      turnEvent,
      sse({ type: "card", card }),
      sse({ type: "text", delta: "Done." }),
      sse({ type: "done", outcome: "complete" }),
    );

    const result = await driver().sendMessage({ conversationId: null, text: "add it" });

    expect(result.cards).toEqual([card]);
  });

  it("should leave cards out when the turn sent none", async () => {
    streamOf(turnEvent, sse({ type: "done", outcome: "complete" }));

    const result = await driver().sendMessage({ conversationId: null, text: "hello" });

    expect(result).not.toHaveProperty("cards");
  });

  it("should keep the code of the notice a failed turn sent, and nothing else of it", async () => {
    streamOf(
      turnEvent,
      sse({ type: "notice", notice: { code: "turn_failed" } }),
      sse({ type: "done", outcome: "failed" }),
    );

    const result = await driver().sendMessage({ conversationId: null, text: "delete them" });

    expect(result.noticeCode).toBe("turn_failed");
  });
});

describe("createHttpDriver, one turn", () => {
  it("should post the turn with the day in the user's time zone, and no hour", async () => {
    streamOf(turnEvent, sse({ type: "done", outcome: "complete" }));

    await driver({
      timeZone: "Pacific/Auckland",
      now: () => new Date("2026-11-03T12:00:00Z"),
    }).sendMessage({ conversationId: null, text: "two eggs" });

    expect(received).toHaveLength(1);
    expect(received[0]?.path).toBe("/functions/v1/assistant/turn");
    expect(received[0]?.body).toEqual({
      conversationId: null,
      text: "two eggs",
      localDate: "2026-11-04",
      localTime: null,
    });
  });

  it("should sign the call with the eval user's token and the project key", async () => {
    streamOf(turnEvent, sse({ type: "done", outcome: "complete" }));

    await driver().sendMessage({ conversationId: CONVERSATION_ID, text: "again" });

    expect(received[0]?.headers["authorization"]).toBe("Bearer token-for-tests");
    expect(received[0]?.headers["apikey"]).toBe("anon-key-for-tests");
    expect(received[0]?.body).toMatchObject({ conversationId: CONVERSATION_ID });
  });

  it("should resolve the result when done arrives, with the answer joined from the text events", async () => {
    streamOf(
      turnEvent,
      sse({ type: "text", delta: "Two eggs " }),
      sse({ type: "text", delta: "logged." }),
      sse({ type: "done", outcome: "complete" }),
    );

    const result = await driver().sendMessage({ conversationId: null, text: "two eggs" });

    expect(result).toEqual({
      conversationId: CONVERSATION_ID,
      turnId: TURN_ID,
      status: "complete",
      answer: "Two eggs logged.",
      toolCalls: [],
    });
  });

  it("should carry the tool calls of the turn that the database read gives", async () => {
    streamOf(turnEvent, sse({ type: "done", outcome: "complete" }));
    const calls: ToolCall[] = [{ name: "search_foods", input: { q: "egg" }, readOnlyHint: true }];
    const readToolCalls = (turnId: string) => Promise.resolve(turnId === TURN_ID ? calls : []);

    const result = await driver({ readToolCalls }).sendMessage({
      conversationId: null,
      text: "eggs",
    });

    expect(result.toolCalls).toEqual(calls);
  });

  it("should carry the citation and the estimate label of the answer_meta event", async () => {
    streamOf(
      turnEvent,
      sse({ type: "text", delta: "Down 0.4 kg." }),
      sse({
        type: "answer_meta",
        citation: "Based on 7 weigh-ins, 12 to 18 Oct",
        estimate: "Trend weight is an estimate",
      }),
      sse({ type: "done", outcome: "complete" }),
    );

    const result = await driver().sendMessage({ conversationId: null, text: "weight trend" });

    expect(result.answerMeta).toEqual({
      citation: "Based on 7 weigh-ins, 12 to 18 Oct",
      estimate: "Trend weight is an estimate",
    });
  });

  it("should leave answerMeta out when the turn sent no answer_meta event", async () => {
    streamOf(turnEvent, sse({ type: "done", outcome: "complete" }));

    const result = await driver().sendMessage({ conversationId: null, text: "hello" });

    expect(result.answerMeta).toBeUndefined();
  });

  it("should carry the question and the button words of the confirm event", async () => {
    streamOf(
      turnEvent,
      sse({
        type: "confirm",
        confirmationId: "33333333-3333-4333-8333-333333333333",
        question:
          "Change your calorie target from 1,300 to 2,000 kcal?\n\nYour macros will be adjusted.",
        confirmLabel: "Change target",
        cancelLabel: "Keep 1,300",
        tone: "primary",
      }),
      sse({ type: "done", outcome: "confirm" }),
    );

    const result = await driver().sendMessage({ conversationId: null, text: "set my calories" });

    expect(result.status).toBe("confirm");
    expect(result.confirmation).toEqual({
      question:
        "Change your calorie target from 1,300 to 2,000 kcal?\n\nYour macros will be adjusted.",
      confirmLabel: "Change target",
      cancelLabel: "Keep 1,300",
    });
  });

  it("should leave confirmation out when the turn asked for none", async () => {
    streamOf(turnEvent, sse({ type: "done", outcome: "complete" }));

    const result = await driver().sendMessage({ conversationId: null, text: "hello" });

    expect(result.confirmation).toBeUndefined();
  });

  it("should resolve a turn that ends failed with that status, and not throw", async () => {
    streamOf(
      turnEvent,
      sse({ type: "notice", notice: { code: "turn_failed" } }),
      sse({ type: "done", outcome: "failed" }),
    );

    const result = await driver().sendMessage({ conversationId: null, text: "eggs" });

    expect(result.status).toBe("failed");
  });
});

describe("createHttpDriver, a stream that cannot be read", () => {
  it("should fail with the field paths of an event that does not parse, never its text", async () => {
    streamOf(
      turnEvent,
      sse({ type: "text", delta: "private words", extra: "private words" }),
      sse({ type: "done", outcome: "complete" }),
    );

    const failure = driver().sendMessage({ conversationId: null, text: "private words" });

    await expect(failure).rejects.toThrow(/invalid_event.*extra/);
    await expect(failure).rejects.not.toThrow(/private words/);
  });

  it("should fail on a line that is not JSON, without printing it", async () => {
    streamOf(turnEvent, "data: not json at all secret\n\n");

    const failure = driver().sendMessage({ conversationId: null, text: "eggs" });

    await expect(failure).rejects.toThrow(/invalid_json/);
    await expect(failure).rejects.not.toThrow(/secret/);
  });

  it("should fail when the stream ends before done", async () => {
    streamOf(turnEvent, sse({ type: "text", delta: "half" }));

    await expect(driver().sendMessage({ conversationId: null, text: "eggs" })).rejects.toThrow(
      /ended before done/,
    );
  });

  it("should fail when done comes before the turn event", async () => {
    streamOf(sse({ type: "done", outcome: "complete" }));

    await expect(driver().sendMessage({ conversationId: null, text: "eggs" })).rejects.toThrow(
      /turn event/,
    );
  });

  it("should fail with the status and the error code of a refused call", async () => {
    answer = (response) => {
      response.writeHead(401, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ error: { code: "unauthorized" } }));
    };

    await expect(driver().sendMessage({ conversationId: null, text: "eggs" })).rejects.toThrow(
      /401.*unauthorized/,
    );
  });
});

describe("createHttpDriver, the shape of the stream on the wire", () => {
  it("should join an event that arrives in two writes, split inside a multibyte character", async () => {
    const bytes = Buffer.from(`${turnEvent}${sse({ type: "text", delta: "café ☕ done" })}`);
    const inside = bytes.indexOf(Buffer.from("☕")) + 1;
    const rest = Buffer.from(sse({ type: "done", outcome: "complete" }));
    answer = (response) => {
      response.writeHead(200, { "Content-Type": "text/event-stream" });
      response.write(bytes.subarray(0, inside));
      setTimeout(() => {
        response.write(bytes.subarray(inside));
        response.end(rest);
      }, 20);
    };

    const result = await driver().sendMessage({ conversationId: null, text: "eggs" });

    expect(result.answer).toBe("café ☕ done");
  });

  it("should name the last notice when the stream ends before done", async () => {
    streamOf(turnEvent, sse({ type: "notice", notice: { code: "consent_needed" } }));

    await expect(driver().sendMessage({ conversationId: null, text: "eggs" })).rejects.toThrow(
      /ended before done.*consent_needed/,
    );
  });

  it("should close the stream when an event does not parse, and not leave it open", async () => {
    let markClosed: () => void = () => undefined;
    const closed = new Promise<void>((resolve) => {
      markClosed = resolve;
    });
    answer = (response) => {
      response.on("close", () => {
        markClosed();
      });
      response.writeHead(200, { "Content-Type": "text/event-stream" });
      // The stream stays open after the bad line, as a stalled function would.
      response.write(`${turnEvent}data: not json\n\n`);
    };

    await expect(driver().sendMessage({ conversationId: null, text: "eggs" })).rejects.toThrow(
      /invalid_json/,
    );

    await closed;
  });

  it("should give up on a stream that never ends after the time it is given", async () => {
    answer = (response) => {
      response.writeHead(200, { "Content-Type": "text/event-stream" });
      response.write(turnEvent);
    };

    await expect(
      driver({ timeoutMilliseconds: 100 }).sendMessage({ conversationId: null, text: "eggs" }),
    ).rejects.toThrow(/timed out|aborted|timeout/i);
  });
});
