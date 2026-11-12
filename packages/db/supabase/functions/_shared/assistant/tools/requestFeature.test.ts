import {
  assert,
  assertEquals,
  assertFalse,
  assertObjectMatch,
  assertStringIncludes,
} from "@std/assert";

import { executeTool } from "../executor.ts";
import { spyOnConsole, userId } from "../testing.ts";
import { requestFeatureTool } from "./requestFeature.ts";
import {
  assistantRow,
  otherConversationId,
  requestFeatureContexts,
  userRow,
  waterRequest,
  later,
} from "./requestFeatureFixtures.ts";
import { payloadOf } from "./testing.ts";
import { structuredOf } from "./writeFixtures.ts";

import type { ToolContext } from "../tool.ts";

const talk = (conversationId: string) => [
  // Newest first. The last message is the one that asked, and the earlier ones are older.
  userRow(3, "Can you track my water intake?", conversationId),
  assistantRow(2, [{ type: "text", text: "Hello, how can I help?" }], conversationId),
  userRow(1, "Hi", conversationId),
];

const rows = (stub: ReturnType<typeof requestFeatureContexts>["stub"]) =>
  stub.tables["feature_requests"] ?? [];

const confirmationIdOf = (result: Awaited<ReturnType<typeof executeTool>>) => {
  assert(result.status === "needs_confirmation");
  return result.confirmationId;
};

Deno.test("asking offers the request to the Ki-Lo team and writes nothing", async () => {
  const { asking, stub, store } = requestFeatureContexts(talk);

  const result = await executeTool(asking, "request_feature", waterRequest);

  assert(result.status === "needs_confirmation");
  assertEquals(result.question, "Send this to the Ki-Lo team as a feature request?");
  assertEquals(
    result.note,
    "A short part of this chat goes with it, and stays even if the chat is deleted.",
  );
  assertEquals(rows(stub).length, 0);
  assertEquals(store.actions.length, 0);
  assertEquals(store.turns[0]?.pending?.tool, "request_feature");
  assertEquals(store.turns[0]?.pending?.confirmLabel, "Send request");
});

Deno.test(
  "the button's words write one request, with the context built from the chat",
  async () => {
    const { asking, confirming, stub } = requestFeatureContexts(talk);
    const confirmationId = confirmationIdOf(
      await executeTool(asking, "request_feature", waterRequest),
    );

    const result = await executeTool(confirming, "request_feature", {
      ...waterRequest,
      confirmation_id: confirmationId,
    });

    assertEquals(result.status, "ok");
    assertEquals(rows(stub).length, 1);
    assertObjectMatch(rows(stub)[0] ?? {}, {
      user_id: userId,
      source: "assistant",
      request: "Track my water intake",
      context: {
        version: 1,
        ask: "Can you track my water intake?",
        unsupported: "Ki-Lo does not track water",
        recent: [
          { role: "user", text: "Hi" },
          { role: "assistant", text: "Hello, how can I help?" },
          { role: "user", text: "Can you track my water intake?" },
        ],
      },
    });
  },
);

Deno.test("the model hears only that the request was sent", async () => {
  const { asking, confirming } = requestFeatureContexts(talk);
  const confirmationId = confirmationIdOf(
    await executeTool(asking, "request_feature", waterRequest),
  );

  const result = await executeTool(confirming, "request_feature", {
    ...waterRequest,
    confirmation_id: confirmationId,
  });

  assertEquals(payloadOf(result), { sent: true });
});

Deno.test("the card says the request was sent, and the action records the new row", async () => {
  const { asking, confirming, stub, store } = requestFeatureContexts(talk);
  const confirmationId = confirmationIdOf(
    await executeTool(asking, "request_feature", waterRequest),
  );

  const result = await executeTool(confirming, "request_feature", {
    ...waterRequest,
    confirmation_id: confirmationId,
  });

  assertObjectMatch(structuredOf(result), {
    card: {
      kind: "feature_requested",
      title: "Feature request sent",
      sub: "Track my water intake",
      link: null,
      undo: "unavailable",
      undoneSub: null,
    },
  });
  const [action] = store.actions;
  assertEquals(action?.tool, "request_feature");
  assertEquals(action?.targetTable, "feature_requests");
  assertEquals(action?.targetId, rows(stub)[0]?.["id"]);
  assertEquals(requestFeatureTool.inverse, null);
});

Deno.test(
  "tool calls, tool results, thinking and the context block never reach the row",
  async () => {
    const { asking, confirming, stub } = requestFeatureContexts((conversationId) => [
      userRow(4, "Can you track my water intake?", conversationId, [
        { type: "tool_result", tool_use_id: "toolu_secret", content: "secret diary row" },
      ]),
      assistantRow(
        3,
        [
          { type: "thinking", thinking: "private reasoning", signature: "sig" },
          { type: "text", text: "Ki-Lo does not track water." },
          { type: "tool_use", id: "toolu_secret", name: "get_day", input: { local_date: "x" } },
        ],
        conversationId,
      ),
    ]);
    const confirmationId = confirmationIdOf(
      await executeTool(asking, "request_feature", waterRequest),
    );

    await executeTool(confirming, "request_feature", {
      ...waterRequest,
      confirmation_id: confirmationId,
    });

    const stored = JSON.stringify(rows(stub)[0]?.["context"]);
    for (const leaked of ["secret", "private reasoning", "tool_use", "Today is", "get_day"]) {
      assertFalse(stored.includes(leaked), leaked);
    }
    assertStringIncludes(stored, "Ki-Lo does not track water.");
  },
);

Deno.test("another conversation's messages are not read", async () => {
  const { asking, confirming, stub } = requestFeatureContexts((conversationId) => [
    userRow(2, "Can you track my water intake?", conversationId),
    userRow(9, "Something said in another chat", otherConversationId),
  ]);
  const confirmationId = confirmationIdOf(
    await executeTool(asking, "request_feature", waterRequest),
  );

  await executeTool(confirming, "request_feature", {
    ...waterRequest,
    confirmation_id: confirmationId,
  });

  assertFalse(JSON.stringify(rows(stub)[0]?.["context"]).includes("another chat"));
});

Deno.test("only the newest 12 messages are read", async () => {
  const { asking, confirming, stub } = requestFeatureContexts((conversationId) => [
    ...Array.from({ length: 14 }, (_, index) =>
      assistantRow(15 - index, [{ type: "text", text: `answer ${15 - index}` }], conversationId),
    ),
    userRow(1, "An ask older than the newest 12", conversationId),
  ]);
  const confirmationId = confirmationIdOf(
    await executeTool(asking, "request_feature", waterRequest),
  );

  await executeTool(confirming, "request_feature", {
    ...waterRequest,
    confirmation_id: confirmationId,
  });

  assertObjectMatch(rows(stub)[0] ?? {}, { context: { ask: "" } });
});

Deno.test("any other answer than the button's asks again and writes nothing", async () => {
  const { asking, contextOn, stub, store } = requestFeatureContexts(talk);
  const confirmationId = confirmationIdOf(
    await executeTool(asking, "request_feature", waterRequest),
  );
  const declining: ToolContext = contextOn(later, "No thanks");

  const result = await executeTool(declining, "request_feature", {
    ...waterRequest,
    confirmation_id: confirmationId,
  });

  assertObjectMatch(result, { status: "needs_confirmation", asksAgain: true });
  assertEquals(rows(stub).length, 0);
  assertEquals(store.actions.length, 0);
});

Deno.test("a spent confirmation cannot send the request twice", async () => {
  const { asking, confirming, stub } = requestFeatureContexts(talk);
  const confirmationId = confirmationIdOf(
    await executeTool(asking, "request_feature", waterRequest),
  );
  const input = { ...waterRequest, confirmation_id: confirmationId };

  const first = await executeTool(confirming, "request_feature", input);
  const again = await executeTool(confirming, "request_feature", input);

  assertEquals(first.status, "ok");
  assertEquals(again.status, "error");
  assertEquals(rows(stub).length, 1);
});

Deno.test("a different request than the one asked about is refused", async () => {
  const { asking, confirming, stub } = requestFeatureContexts(talk);
  const confirmationId = confirmationIdOf(
    await executeTool(asking, "request_feature", waterRequest),
  );

  const result = await executeTool(confirming, "request_feature", {
    request: "Something else entirely",
    unsupported: waterRequest.unsupported,
    confirmation_id: confirmationId,
  });

  assertEquals(result.status, "error");
  assertEquals(rows(stub).length, 0);
});

Deno.test("a request that is too short or too long is invalid input", async () => {
  const { asking } = requestFeatureContexts(talk);

  for (const input of [
    { ...waterRequest, request: "ab" },
    { ...waterRequest, request: "a".repeat(301) },
    { ...waterRequest, unsupported: "ab" },
    { ...waterRequest, unsupported: "a".repeat(201) },
  ]) {
    const result = await executeTool(asking, "request_feature", input);

    assertEquals(result.status, "error");
    assertStringIncludes(result.text, "invalid_input");
  }
});

Deno.test(
  "the daily cap is answered to the model as rate_limited, and nothing is kept",
  async () => {
    const { asking, confirming, stub, store } = requestFeatureContexts(talk);
    const confirmationId = confirmationIdOf(
      await executeTool(asking, "request_feature", waterRequest),
    );
    const capped: ToolContext = {
      ...confirming,
      caller: {
        ...stub.caller,
        from: (table: string) =>
          table === "feature_requests"
            ? {
                insert: () => ({
                  select: () => ({
                    single: () =>
                      Promise.resolve({
                        data: null,
                        error: { code: "54000", message: "feature_requests_daily_cap" },
                      }),
                  }),
                }),
              }
            : stub.caller.from("assistant_messages"),
      },
    } as unknown as ToolContext;

    const result = await executeTool(capped, "request_feature", {
      ...waterRequest,
      confirmation_id: confirmationId,
    });

    assertEquals(result.status, "ok");
    assertEquals(payloadOf(result), { error: "rate_limited" });
    assertEquals(store.actions.length, 0);
  },
);

Deno.test("a failed write answers tool_failed and reports no request text", async () => {
  const consoleSpy = spyOnConsole();
  try {
    const { asking, confirming, stub, store } = requestFeatureContexts(talk);
    const confirmationId = confirmationIdOf(
      await executeTool(asking, "request_feature", waterRequest),
    );
    stub.failNextWriteTo("feature_requests");

    const result = await executeTool(confirming, "request_feature", {
      ...waterRequest,
      confirmation_id: confirmationId,
    });

    assertEquals(result.status, "error");
    assertStringIncludes(result.text, "tool_failed");
    assertEquals(store.actions.length, 0);
    assertFalse(result.text.includes("water"));
    assertFalse(consoleSpy.lines.join("\n").includes("water"));
  } finally {
    consoleSpy.restore();
  }
});

Deno.test("the description keeps the offer to the cases Ki-Lo has no such feature", () => {
  const { description } = requestFeatureTool;

  assertStringIncludes(description, "in the same response as the call, before it");
  assertStringIncludes(description, "When they decline, do not call again.");
  assert(description.length < 700, `${description.length} characters`);
});
