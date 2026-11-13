// The hidden kitchen tool group on the real turn loop (ADR 0006, Amendment 5), with a scripted model and the
// turn store over its fake client. The kitchen tools here are listed stand-ins: the loop knows the group by
// the tools' own `group`, never by a name.
import { assert, assertEquals, assertFalse } from "@std/assert";

import { DEFAULT_COMPACT_AT_TOKENS } from "./compact.ts";
import { KITCHEN_BETA, kitchenAdditionContent } from "./kitchen.ts";
import { createHarness, fakeTools, listedKitchen } from "./turnTesting.ts";

import type { ListedTool } from "../_shared/assistant/mcpClient.ts";
import type { Harness, HarnessOptions, ScriptedResponse } from "./turnTesting.ts";

const kitchenRead = listedKitchen("kitchen_read", true, { note: { type: "string" } });
const kitchenWrite = listedKitchen("kitchen_write", false, { note: { type: "string" } });
const tools: ListedTool[] = [...fakeTools, kitchenRead, kitchenWrite];

const addition = kitchenAdditionContent(["kitchen_read", "kitchen_write"]);

const reply = (text: string): ScriptedResponse => ({
  blocks: [{ type: "text", text }],
  stopReason: "end_turn",
});

async function withHarness(
  options: HarnessOptions,
  body: (harness: Harness) => Promise<void>,
): Promise<void> {
  const harness = await createHarness({ tools, kitchen: true, ...options });
  try {
    await body(harness);
  } finally {
    await harness.shutdown();
  }
}

type RequestBody = {
  tools: { name: string; defer_loading?: boolean }[];
  messages: { role: string; content: unknown }[];
};

const requestsOf = (harness: Harness): RequestBody[] =>
  harness.mock.json().flatMap((body) => (body["stream"] === true ? [body as RequestBody] : []));

const rolesOf = (request: RequestBody | undefined) =>
  (request?.messages ?? []).map((message) => message.role);

const withoutBreakpoints = (value: unknown): string =>
  JSON.stringify(value, (key, child: unknown) => (key === "cache_control" ? undefined : child));

const additionRowsOf = (harness: Harness) =>
  harness.storedRows().filter((row) => row.role === "system");

const storedRolesOf = (harness: Harness) => harness.storedRows().map((row) => row.role);

const allowedOf = (harness: Harness, index: number) => harness.connectOptions[index]?.allowedTools;

Deno.test(
  "the kitchen tools are sent with defer_loading, after the others, and the beta header goes with them",
  async () => {
    await withHarness({ responses: [reply("Hello.")] }, async (harness) => {
      await harness.take("log an apple");

      const [request] = requestsOf(harness);
      assertEquals(
        request?.tools.map((tool) => tool.name),
        tools.map((tool) => tool.name),
      );
      assertEquals(
        request?.tools.map((tool) => tool.defer_loading === true),
        tools.map((tool) => tool.group === "kitchen"),
      );
      assertEquals(harness.mock.betaHeaders, [KITCHEN_BETA]);
    });
  },
);

Deno.test("a request with no deferred tool sends no beta header", async () => {
  await withHarness({ responses: [reply("Hello.")], tools: fakeTools }, async (harness) => {
    await harness.take("log an apple");

    assertEquals(harness.mock.betaHeaders, [null]);
  });
});

Deno.test(
  "a kitchen request with the switch off appends nothing and allows no kitchen tool",
  async () => {
    await withHarness({ responses: [reply("Hello.")], kitchen: false }, async (harness) => {
      await harness.take("Make me a meal plan for the week");

      assertEquals(additionRowsOf(harness), []);
      assertEquals(rolesOf(requestsOf(harness)[0]), ["user"]);
      assertFalse(allowedOf(harness, 0)?.some((name) => name.startsWith("kitchen_")) ?? true);
    });
  },
);

Deno.test(
  "a kitchen request with the switch on stores one system message after the user's and sends it",
  async () => {
    await withHarness({ responses: [reply("Here is a plan.")] }, async (harness) => {
      await harness.take("Make me a meal plan for the week");

      assertEquals(storedRolesOf(harness), ["user", "system", "assistant"]);
      assertEquals(additionRowsOf(harness)[0]?.content, addition);
      assertEquals(rolesOf(requestsOf(harness)[0]), ["user", "system"]);
      assertEquals(requestsOf(harness)[0]?.messages[1]?.content, addition);
      assertEquals(allowedOf(harness, 0)?.includes("kitchen_write"), true);
      assertEquals(allowedOf(harness, 0)?.includes("kitchen_read"), true);
    });
  },
);

Deno.test(
  "a message with no kitchen words and no entry appends nothing and allows no kitchen tool",
  async () => {
    await withHarness({ responses: [reply("Logged.")] }, async (harness) => {
      await harness.take("log an apple");

      assertEquals(additionRowsOf(harness), []);
      assertFalse(allowedOf(harness, 0)?.some((name) => name.startsWith("kitchen_")) ?? true);
    });
  },
);

Deno.test("an entry from the app makes a kitchen turn whatever the words", async () => {
  await withHarness({ responses: [reply("Hello.")] }, async (harness) => {
    await harness.take("Hello", { entry: "plan" });

    assertEquals(additionRowsOf(harness).length, 1);
  });
});

Deno.test("nothing is appended when the list holds no kitchen tool", async () => {
  await withHarness({ responses: [reply("Hello.")], tools: fakeTools }, async (harness) => {
    await harness.take("Make me a meal plan for the week");

    assertEquals(additionRowsOf(harness), []);
  });
});

Deno.test(
  "the group stays surfaced: a later turn replays the stored message in place and appends no second",
  async () => {
    await withHarness(
      { responses: [reply("Here is a plan."), reply("Logged.")] },
      async (harness) => {
        await harness.take("Make me a meal plan for the week");
        await harness.take("log an apple");

        assertEquals(additionRowsOf(harness).length, 1);
        assertEquals(storedRolesOf(harness), ["user", "system", "assistant", "user", "assistant"]);
        const [first, next] = requestsOf(harness);
        assertEquals(rolesOf(next), ["user", "system", "assistant", "user"]);
        // History is append only: everything the first request sent, the second sends again, byte for byte.
        assert(
          withoutBreakpoints(next?.messages).startsWith(
            withoutBreakpoints(first?.messages).slice(0, -1),
          ),
        );
        // The tools array is the same bytes, and the kitchen tools are callable on a turn of ordinary words.
        assertEquals(JSON.stringify(next?.tools), JSON.stringify(first?.tools));
        assertEquals(allowedOf(harness, 1)?.includes("kitchen_write"), true);
      },
    );
  },
);

Deno.test(
  "a kitchen tool is called through the connection on a turn where it is surfaced",
  async () => {
    await withHarness(
      {
        responses: [
          {
            blocks: [
              { type: "tool_use", id: "call-1", name: "kitchen_read", input: { note: "x" } },
            ],
            stopReason: "tool_use",
          },
          reply("Done."),
        ],
      },
      async (harness) => {
        await harness.take("What do I usually eat for breakfast?");

        assertEquals(
          harness.connections[0]?.calls.map((call) => call.name),
          ["kitchen_read"],
        );
        const [first, second] = requestsOf(harness);
        assertEquals(rolesOf(first), ["user", "system"]);
        assertEquals(rolesOf(second), ["user", "system", "assistant", "user"]);
        assertEquals(additionRowsOf(harness).length, 1);
      },
    );
  },
);

Deno.test(
  "after a compaction the next turn appends the addition again, after the note",
  async () => {
    const big = { input: DEFAULT_COMPACT_AT_TOKENS + 10_000 };
    await withHarness(
      {
        responses: [
          { ...reply("Here is a plan."), usage: big },
          reply("A note."),
          reply("Logged."),
        ],
      },
      async (harness) => {
        await harness.take("Make me a meal plan for the week");
        await harness.finishBackground();
        assertEquals(harness.conversationRows()[0]?.["compaction_summary"], "A note.");

        await harness.take("log an apple");

        assertEquals(additionRowsOf(harness).length, 2);
        const last = harness.mock.json().at(-1) as RequestBody;
        assertEquals(rolesOf(last), ["user", "system"]);
        assertEquals(last.messages[1]?.content, addition);
        assert(JSON.stringify(last.messages[0]).includes("A note."));
        assertEquals(allowedOf(harness, 1)?.includes("kitchen_write"), true);
      },
    );
  },
);

Deno.test(
  "a turn that failed after the addition was stored does not leave a second one behind",
  async () => {
    await withHarness(
      {
        responses: [
          { blocks: [], stopReason: "end_turn", httpStatus: 400 },
          reply("Here is a plan."),
        ],
      },
      async (harness) => {
        await harness.take("Make me a meal plan for the week");
        await harness.take("Make me a meal plan for the week please");

        const retry = requestsOf(harness).at(-1);
        // The first addition is not sent, because the next user row follows it, so one is sent: its two tools.
        assertEquals(additionRowsOf(harness).length, 2);
        assertEquals(rolesOf(retry), ["user", "system"]);
        assertEquals(JSON.stringify(retry?.messages).split("tool_addition").length - 1, 2);
      },
    );
  },
);

Deno.test("a conversation that already had an answer survives a failed kitchen turn", async () => {
  await withHarness(
    {
      responses: [
        reply("Hello."),
        { blocks: [], stopReason: "end_turn", httpStatus: 400 },
        reply("Logged."),
      ],
    },
    async (harness) => {
      await harness.take("hello");
      const failed = await harness.take("Make me a meal plan for the week");
      const next = await harness.take("log an apple");

      assertEquals(
        failed.events.some((event) => event.type === "done" && event.outcome === "failed"),
        true,
      );
      assertEquals(
        next.events.some((event) => event.type === "done" && event.outcome === "complete"),
        true,
      );
      assertEquals(harness.reports.length, 1);
      const last = requestsOf(harness).at(-1);
      assertEquals(rolesOf(last), ["user", "assistant", "user", "system"]);
    },
  );
});

Deno.test("a turn whose answer was only thinking does not break the next turn", async () => {
  await withHarness(
    {
      responses: [
        {
          blocks: [{ type: "thinking", thinking: "hm", signature: "sig" }],
          stopReason: "max_tokens",
        },
        reply("Here is a plan."),
      ],
    },
    async (harness) => {
      await harness.take("Make me a meal plan for the week");
      const next = await harness.take("Make me a meal plan for the week please");

      assertEquals(
        next.events.some((event) => event.type === "done" && event.outcome === "complete"),
        true,
      );
      assertEquals(rolesOf(requestsOf(harness).at(-1)), ["user", "system"]);
    },
  );
});

Deno.test(
  "the beta header still goes with a replay that holds the addition after the kitchen tools are gone",
  async () => {
    // A later deploy with the probe unset lists no kitchen tool, and an old kitchen conversation still holds its
    // tool_addition blocks. The list is read once and kept, so removing the tools from the array is that deploy.
    const listed = [...tools];
    await withHarness(
      { responses: [reply("Here is a plan."), reply("Logged.")], tools: listed },
      async (harness) => {
        await harness.take("Make me a meal plan for the week");
        listed.splice(0, listed.length, ...fakeTools);

        await harness.take("log an apple");

        assertEquals(harness.mock.betaHeaders, [KITCHEN_BETA, KITCHEN_BETA]);
        assertEquals(
          requestsOf(harness)[1]?.tools.some((tool) => tool.defer_loading === true),
          false,
        );
      },
    );
  },
);
