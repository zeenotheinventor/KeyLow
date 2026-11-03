import { describe, expect, it } from "vitest";

import { defaultReply, messageStreamOf } from "./anthropicStream";

import type { ScriptedReply } from "./anthropicMock";

// The Messages API streams `message_start`, then `ping`, then for each block a `content_block_start`,
// its deltas and a `content_block_stop`, then `message_delta` (stop reason and output tokens) and
// `message_stop` (claude-api skill, typescript/claude-api/streaming.md, "Stream Event Types").

type StreamEvent = { name: string; data: Record<string, unknown> };

function parse(stream: string): StreamEvent[] {
  return stream
    .split("\n\n")
    .filter((block) => block !== "")
    .map((block) => {
      const [eventLine = "", dataLine = ""] = block.split("\n");
      const data: unknown = JSON.parse(dataLine.replace(/^data: /, ""));
      if (typeof data !== "object" || data === null) {
        throw new Error("An event held no object");
      }
      return { name: eventLine.replace(/^event: /, ""), data: { ...data } };
    });
}

const textReply: ScriptedReply = {
  blocks: [{ type: "text", text: "Two eggs on toast, logged." }],
  stopReason: "end_turn",
};

describe("messageStreamOf", () => {
  it("should stream the events in the order the Messages API does", () => {
    const events = parse(messageStreamOf(textReply, 0));

    expect(events.map(({ name }) => name)).toEqual([
      "message_start",
      "ping",
      "content_block_start",
      ...events
        .filter(({ name }) => name === "content_block_delta")
        .map(() => "content_block_delta"),
      "content_block_stop",
      "message_delta",
      "message_stop",
    ]);
  });

  it("should name each event in its own data as well", () => {
    const events = parse(messageStreamOf(textReply, 0));

    expect(events.every(({ name, data }) => data["type"] === name)).toBe(true);
  });

  it("should split the text into deltas that join back to the text", () => {
    const deltas = parse(messageStreamOf(textReply, 0))
      .filter(({ name }) => name === "content_block_delta")
      .map(({ data }) => data["delta"]);

    expect(deltas.length).toBeGreaterThan(1);
    expect(
      deltas
        .map((delta) =>
          typeof delta === "object" && delta !== null && "text" in delta ? delta.text : "",
        )
        .join(""),
    ).toBe("Two eggs on toast, logged.");
  });

  it("should open a tool_use block with an empty input and stream the input as JSON deltas", () => {
    const events = parse(
      messageStreamOf(
        {
          blocks: [
            {
              type: "tool_use",
              id: "toolu_01",
              name: "search_foods",
              input: { q: "egg", limit: 5 },
            },
          ],
          stopReason: "tool_use",
        },
        0,
      ),
    );

    const start = events.find(({ name }) => name === "content_block_start");
    expect(start?.data["content_block"]).toEqual({
      type: "tool_use",
      id: "toolu_01",
      name: "search_foods",
      input: {},
    });
    const json = events
      .filter(({ name }) => name === "content_block_delta")
      .map(({ data }) => data["delta"])
      .map((delta) =>
        typeof delta === "object" && delta !== null && "partial_json" in delta
          ? delta.partial_json
          : "",
      )
      .join("");
    expect(JSON.parse(json)).toEqual({ q: "egg", limit: 5 });
  });

  it("should number the blocks by their position", () => {
    const events = parse(
      messageStreamOf(
        {
          blocks: [
            { type: "text", text: "Looking." },
            { type: "tool_use", id: "toolu_02", name: "get_day", input: {} },
          ],
          stopReason: "tool_use",
        },
        0,
      ),
    );

    expect(
      events.filter(({ name }) => name === "content_block_start").map(({ data }) => data["index"]),
    ).toEqual([0, 1]);
  });

  it("should carry the stop reason in message_delta and the cache fields in message_start", () => {
    const events = parse(
      messageStreamOf(
        { ...textReply, usage: { input: 321, output: 45, cacheRead: 200, cacheCreation: 100 } },
        0,
      ),
    );

    const start = events.find(({ name }) => name === "message_start");
    expect(start?.data["message"]).toMatchObject({
      role: "assistant",
      stop_reason: null,
      usage: {
        input_tokens: 321,
        cache_read_input_tokens: 200,
        cache_creation_input_tokens: 100,
      },
    });
    const delta = events.find(({ name }) => name === "message_delta");
    expect(delta?.data).toMatchObject({
      delta: { stop_reason: "end_turn" },
      usage: { output_tokens: 45 },
    });
  });

  it("should give every reply of one script its own message id", () => {
    const idOf = (index: number) => {
      const start = parse(messageStreamOf(textReply, index)).find(
        ({ name }) => name === "message_start",
      );
      const message = start?.data["message"];
      return typeof message === "object" && message !== null && "id" in message ? message.id : null;
    };

    expect(idOf(0)).not.toBe(idOf(1));
    expect(idOf(0)).not.toBeNull();
  });
});

describe("defaultReply", () => {
  it("should be one short text reply that ends the turn", () => {
    expect(defaultReply.stopReason).toBe("end_turn");
    expect(defaultReply.blocks).toHaveLength(1);
    expect(defaultReply.blocks[0]?.type).toBe("text");
  });
});
