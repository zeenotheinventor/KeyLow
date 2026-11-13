import { createServer } from "node:http";
import { text } from "node:stream/consumers";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { JUDGE_MODEL, createAnthropicJudgeClient, createJudge } from "../src/judge.ts";

import type { JudgeClient } from "../src/judge.ts";
import type { IncomingMessage, Server, ServerResponse } from "node:http";

// Nothing here reaches a model: the judge is given a client by hand, and the Anthropic client talks to a stub
// HTTP server on this machine.

const clientAnswering = (
  ...replies: { text: string; inputTokens: number; outputTokens: number }[]
): JudgeClient & { asked: { system: string; user: string }[] } => {
  const asked: { system: string; user: string }[] = [];
  return {
    asked,
    ask: (request) => {
      asked.push(request);
      const reply = replies[asked.length - 1];
      return reply === undefined
        ? Promise.reject(new Error("the client has no reply left"))
        : Promise.resolve(reply);
    },
  };
};

describe("createJudge", () => {
  it("should answer the text of the reply and send the request as it was given", async () => {
    const client = clientAnswering({ text: "a score", inputTokens: 10, outputTokens: 2 });
    const judge = createJudge(client);

    const reply = await judge.ask({ system: "rules", user: "a draft" });

    expect(reply).toBe("a score");
    expect(client.asked).toEqual([{ system: "rules", user: "a draft" }]);
  });

  it("should count the input and output tokens of every call, and nothing before the first", async () => {
    const judge = createJudge(
      clientAnswering(
        { text: "a", inputTokens: 800, outputTokens: 60 },
        { text: "b", inputTokens: 700, outputTokens: 40 },
      ),
    );
    expect(judge.tokens()).toBe(0);

    await judge.ask({ system: "s", user: "u" });
    await judge.ask({ system: "s", user: "u" });

    expect(judge.tokens()).toBe(1_600);
    expect(judge.usage()).toEqual({ calls: 2, inputTokens: 1_500, outputTokens: 100 });
  });

  it("should count nothing for a call that failed, and let the failure through", async () => {
    const judge = createJudge(clientAnswering());

    await expect(judge.ask({ system: "s", user: "u" })).rejects.toThrow("no reply left");

    expect(judge.tokens()).toBe(0);
  });
});

describe("the judge model", () => {
  it("should be Haiku 5.5, a different model from the Opus that writes the drafts", () => {
    expect(JUDGE_MODEL).toBe("claude-haiku-5-5");
  });
});

describe("createAnthropicJudgeClient", () => {
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

  const respondWith = (status: number, body: unknown) => {
    received = [];
    answer = (response) => {
      response.writeHead(status, { "Content-Type": "application/json" });
      response.end(JSON.stringify(body));
    };
  };

  const clientWithKey = (apiKey: string | undefined) =>
    createAnthropicJudgeClient({ apiKey: () => apiKey, baseUrl });
  const client = () => clientWithKey("key-for-tests");

  it("should post one message to the Haiku model with the key, and read the text and the tokens", async () => {
    respondWith(200, {
      content: [
        { type: "text", text: '{"fit": 2}' },
        { type: "text", text: " tail" },
      ],
      usage: { input_tokens: 812, output_tokens: 61 },
    });

    const reply = await client().ask({ system: "the rules", user: "the draft" });

    expect(reply).toEqual({ text: '{"fit": 2} tail', inputTokens: 812, outputTokens: 61 });
    expect(received).toHaveLength(1);
    expect(received[0]?.path).toBe("/v1/messages");
    expect(received[0]?.headers["x-api-key"]).toBe("key-for-tests");
    expect(received[0]?.headers["anthropic-version"]).toBe("2023-06-01");
    expect(received[0]?.body).toMatchObject({
      model: "claude-haiku-5-5",
      system: "the rules",
      messages: [{ role: "user", content: "the draft" }],
    });
  });

  it("should fail with the status and the error type, and never the body, when the API refuses", async () => {
    respondWith(429, { error: { type: "rate_limit_error", message: "a secret recipe name" } });

    const failure = client().ask({ system: "s", user: "u" });

    await expect(failure).rejects.toThrow("The judge call failed: 429 rate_limit_error");
    await expect(failure).rejects.not.toThrow("secret");
  });

  it("should fail with a message that names the key when none is set, and make no call", async () => {
    received = [];

    await expect(clientWithKey("  ").ask({ system: "s", user: "u" })).rejects.toThrow(
      "ANTHROPIC_API_KEY is not set",
    );
    await expect(clientWithKey(undefined).ask({ system: "s", user: "u" })).rejects.toThrow(
      "ANTHROPIC_API_KEY is not set",
    );

    expect(received).toHaveLength(0);
  });

  it("should fail when the reply has no text or no token counts", async () => {
    respondWith(200, { content: [], usage: { input_tokens: 1, output_tokens: 1 } });
    await expect(client().ask({ system: "s", user: "u" })).rejects.toThrow("no text");

    respondWith(200, { content: [{ type: "text", text: "x" }] });
    await expect(client().ask({ system: "s", user: "u" })).rejects.toThrow("no token counts");
  });
});
