import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createAnthropicMockClient } from "./anthropicMock";
import { startOffMock } from "./offMockServer";

import type { AnthropicMockClient } from "./anthropicMock";
import type { OffMockServer } from "./offMockServer";

// The Messages API routes of the mock server, called as the Anthropic SDK calls them: a streamed POST
// to /anthropic/v1/messages. Each test uses a marker of its own, as the real suites do.

let server: OffMockServer | undefined;
let baseUrl: string;
let client: AnthropicMockClient;

beforeAll(async () => {
  server = await startOffMock(0);
  baseUrl = `http://127.0.0.1:${server.port}`;
  client = createAnthropicMockClient(baseUrl);
});

afterAll(async () => {
  await server?.close();
});

const marker = () => `marker-${crypto.randomUUID()}`;

async function postMessages(
  text: string,
  options: { stream?: boolean; headers?: Record<string, string> } = {},
) {
  const response = await fetch(`${baseUrl}/anthropic/v1/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": "test",
      "anthropic-version": "2023-06-01",
      ...options.headers,
    },
    body: JSON.stringify({
      model: "claude-haiku-5-5",
      max_tokens: 1024,
      stream: options.stream ?? true,
      messages: [{ role: "user", content: [{ type: "text", text }] }],
    }),
  });
  return {
    status: response.status,
    contentType: response.headers.get("content-type"),
    text: await response.text(),
  };
}

const eventNames = (stream: string) =>
  [...stream.matchAll(/^event: (.+)$/gm)].map((match) => match[1]);

describe("POST /anthropic/v1/messages", () => {
  it("answers one short text reply, as a stream, when no script is registered", async () => {
    const response = await postMessages(`nothing registered ${marker()}`);

    expect(response.status).toBe(200);
    expect(response.contentType).toContain("text/event-stream");
    expect(eventNames(response.text)[0]).toBe("message_start");
    expect(eventNames(response.text).at(-1)).toBe("message_stop");
    expect(response.text).toContain('"stop_reason":"end_turn"');
  });

  it("answers the replies of a script in order, one for each request that carries the marker", async () => {
    const own = marker();
    await client.script(own, [
      {
        blocks: [{ type: "tool_use", id: "toolu_a", name: "search_foods", input: { q: "egg" } }],
        stopReason: "tool_use",
      },
      { blocks: [{ type: "text", text: "Found it." }], stopReason: "end_turn" },
    ]);

    const first = await postMessages(`first ${own}`);
    const second = await postMessages(`second ${own}`);

    expect(first.text).toContain('"stop_reason":"tool_use"');
    expect(first.text).toContain('"id":"toolu_a"');
    expect(second.text).toContain("Found ");
    expect(second.text).toContain('"stop_reason":"end_turn"');
  });

  it("records the body of each request of a marker, and none of another marker", async () => {
    const own = marker();
    const other = marker();
    await client.script(own, [
      { blocks: [{ type: "text", text: "One." }], stopReason: "end_turn" },
    ]);
    await client.script(other, [
      { blocks: [{ type: "text", text: "Two." }], stopReason: "end_turn" },
    ]);

    await postMessages(`a ${own}`);
    await postMessages(`b ${other}`);

    const requests = await client.requests(own);
    expect(requests).toHaveLength(1);
    expect(JSON.stringify(requests[0])).toContain(own);
    expect(JSON.stringify(requests[0])).not.toContain(other);
    expect(requests[0]).toMatchObject({ model: "claude-haiku-5-5", stream: true });
  });

  it("answers a 400 in the API's error shape when the script has no reply left", async () => {
    const own = marker();
    await client.script(own, [
      { blocks: [{ type: "text", text: "Only one." }], stopReason: "end_turn" },
    ]);
    await postMessages(own);

    const response = await postMessages(own);

    expect(response.status).toBe(400);
    expect(JSON.parse(response.text)).toMatchObject({
      type: "error",
      error: { type: "invalid_request_error" },
    });
  });

  it("forgets the script and the requests of a marker", async () => {
    const own = marker();
    await client.script(own, [
      { blocks: [{ type: "text", text: "Gone." }], stopReason: "end_turn" },
    ]);
    await postMessages(own);

    await client.forget(own);

    expect(await client.requests(own)).toEqual([]);
    expect((await postMessages(own)).text).toContain("Noted.");
  });

  it("refuses a request that is not a stream, as the function never sends one", async () => {
    const response = await postMessages(marker(), { stream: false });

    expect(response.status).toBe(400);
  });

  it("takes the API key as a bearer token too, which is how the SDK sends it", async () => {
    const response = await postMessages(marker(), {
      headers: { "x-api-key": "", Authorization: "Bearer test" },
    });

    expect(response.status).toBe(200);
  });

  it("refuses a request with no API key", async () => {
    const response = await postMessages(marker(), { headers: { "x-api-key": "" } });

    expect(response.status).toBe(401);
    expect(JSON.parse(response.text)).toMatchObject({ error: { type: "authentication_error" } });
  });
});
