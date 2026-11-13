// The generation tools on the real turn loop (ADR 0006, Amendment 6): a 55 s call timeout with no retry, which
// the MCP client carries out, and a start only while 65 s of the 150 s wall clock remain. The tool here is a
// listed stand-in: the loop knows a generation tool by the tool's own `generation` flag, never by a name.
import { assert, assertEquals } from "@std/assert";

import { GENERATION_CALL_TIMEOUT_MILLISECONDS } from "../_shared/assistant/mcpClient.ts";
import {
  GENERATION_START_MINIMUM_REMAINING_MILLISECONDS,
  MAX_GENERATION_CALLS_PER_TURN,
  MCP_REQUEST_TIMEOUT_MILLISECONDS,
  MODEL_STREAM_IDLE_MILLISECONDS,
  TURN_DEADLINE_MILLISECONDS,
} from "./turn.ts";
import { createHarness, fakeTools, listed, listedGeneration } from "./turnTesting.ts";

import type { Harness, HarnessOptions, ScriptedResponse } from "./turnTesting.ts";
import type { TurnLimits } from "./turn.ts";

const generationTool = listedGeneration("generate_one", { note: { type: "string" } });
const otherRead = listed("read_two", true, { note: { type: "string" } });
const tools = [...fakeTools, generationTool, otherRead];

const callOf = (name: string): ScriptedResponse => ({
  blocks: [{ type: "tool_use", id: "call-1", name, input: { note: "x" } }],
  stopReason: "tool_use",
});

const answer: ScriptedResponse = {
  blocks: [{ type: "text", text: "Done." }],
  stopReason: "end_turn",
};

const limitsWithWallClock = (wallClockMilliseconds: number): TurnLimits => ({
  deadlineMilliseconds: TURN_DEADLINE_MILLISECONDS,
  streamIdleMilliseconds: MODEL_STREAM_IDLE_MILLISECONDS,
  wallClockMilliseconds,
});

async function withHarness(
  options: HarnessOptions,
  body: (harness: Harness) => Promise<void>,
): Promise<void> {
  const harness = await createHarness({ tools, ...options });
  try {
    await body(harness);
  } finally {
    await harness.shutdown();
  }
}

type Request = { messages: { role: string; content: unknown }[] };

const lastUserContentOf = (harness: Harness): string => {
  const requests = harness.mock
    .json()
    .flatMap((body) => (body["stream"] === true ? [body as Request] : []));
  return JSON.stringify(requests.at(-1)?.messages.at(-1)?.content);
};

Deno.test(
  "the wall clock a generation tool needs is a literal 65 s, and an ordinary call stays at 20 s",
  () => {
    assertEquals(GENERATION_START_MINIMUM_REMAINING_MILLISECONDS, 65_000);
    assertEquals(GENERATION_CALL_TIMEOUT_MILLISECONDS, 55_000);
    assertEquals(MCP_REQUEST_TIMEOUT_MILLISECONDS, 20_000);
    assertEquals(TURN_DEADLINE_MILLISECONDS, 100_000);
  },
);

Deno.test(
  "the connection is opened with the 55 s generation timeout and the 20 s request timeout",
  async () => {
    await withHarness({ responses: [answer] }, async (harness) => {
      await harness.take("hello");

      assertEquals(harness.connectOptions[0]?.requestTimeoutMilliseconds, 20_000);
      assertEquals(harness.connectOptions[0]?.generationCallTimeoutMilliseconds, 55_000);
    });
  },
);

Deno.test("a generation tool starts when more than 65 s of the wall clock remain", async () => {
  await withHarness(
    { responses: [callOf("generate_one"), answer], limits: limitsWithWallClock(66_000) },
    async (harness) => {
      await harness.take("hello");

      assertEquals(
        harness.connections[0]?.calls.map((call) => call.name),
        ["generate_one"],
      );
    },
  );
});

Deno.test(
  "a generation tool does not start with less than 65 s left, and the model is told to try again",
  async () => {
    await withHarness(
      { responses: [callOf("generate_one"), answer], limits: limitsWithWallClock(64_000) },
      async (harness) => {
        const { events } = await harness.take("hello");

        assertEquals(harness.connections[0]?.calls, []);
        const result = lastUserContentOf(harness);
        assert(result.includes("busy_try_again"), result);
        assert(result.includes("is_error"), result);
        assert(events.some((event) => event.type === "done"));
      },
    );
  },
);

Deno.test("another tool starts however little of the wall clock remains", async () => {
  await withHarness(
    { responses: [callOf("read_two"), answer], limits: limitsWithWallClock(30_000) },
    async (harness) => {
      await harness.take("hello");

      assertEquals(
        harness.connections[0]?.calls.map((call) => call.name),
        ["read_two"],
      );
    },
  );
});

Deno.test("with the real wall clock of 150 s a fresh turn starts a generation tool", async () => {
  await withHarness({ responses: [callOf("generate_one"), answer] }, async (harness) => {
    await harness.take("hello");

    assertEquals(
      harness.connections[0]?.calls.map((call) => call.name),
      ["generate_one"],
    );
  });
});

Deno.test(
  "a turn makes one generation call, and the second is answered before it runs",
  async () => {
    const twoCalls: ScriptedResponse = {
      blocks: [
        { type: "tool_use", id: "call-1", name: "generate_one", input: { note: "x" } },
        { type: "tool_use", id: "call-2", name: "generate_one", input: { note: "y" } },
      ],
      stopReason: "tool_use",
    };
    await withHarness({ responses: [twoCalls, answer] }, async (harness) => {
      await harness.take("hello");

      assertEquals(
        harness.connections[0]?.calls.map((call) => call.name),
        ["generate_one"],
      );
      const result = lastUserContentOf(harness);
      assert(result.includes("one_generation_per_turn"), result);
      assert(result.includes("is_error"), result);
    });
  },
);

Deno.test("the generation calls a turn may make are a literal 1", () => {
  assertEquals(MAX_GENERATION_CALLS_PER_TURN, 1);
});

Deno.test("a generation call is capped by the flag and not by the tool's name", async () => {
  const other = listedGeneration("generate_two", { note: { type: "string" } });
  const mixed: ScriptedResponse = {
    blocks: [
      { type: "tool_use", id: "call-1", name: "generate_one", input: { note: "x" } },
      { type: "tool_use", id: "call-2", name: "generate_two", input: { note: "y" } },
      { type: "tool_use", id: "call-3", name: "read_two", input: { note: "z" } },
    ],
    stopReason: "tool_use",
  };
  await withHarness({ responses: [mixed, answer], tools: [...tools, other] }, async (harness) => {
    await harness.take("hello");

    assertEquals(
      harness.connections[0]?.calls.map((call) => call.name),
      ["generate_one", "read_two"],
    );
  });
});
