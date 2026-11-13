import { assertEquals } from "@std/assert";

import { spyOnConsole } from "../_shared/assistant/testing.ts";
import { error } from "../_shared/http.ts";
import { createAssistantHandler } from "./routes.ts";
import { writeEvent } from "./sse.ts";
import { ConversationBusyError } from "./turnStore.ts";

import type { UndoResult } from "../_shared/assistant/undo.ts";
import type { ReportError } from "../_shared/report.ts";
import type { AccessStore } from "./gates.ts";
import type { AssistantDependencies } from "./routes.ts";
import type { RunTurn, TurnContext } from "./runTurn.ts";
import type { TurnStore } from "./turnStore.ts";

const userId = "00000000-0000-4000-8000-0000000000a1";
const conversationId = "00000000-0000-4000-8000-0000000000c1";
const turnId = "00000000-0000-4000-8000-0000000000d3";
const userMessageId = "00000000-0000-4000-8000-0000000000f1";
const actionId = "00000000-0000-4000-8000-0000000000e5";
const secretText = "my private lunch note 4821";

type Started = { userId: string; conversationId: string; text: string };

type Fake = {
  dependencies: AssistantDependencies;
  started: Started[];
  conversations: string[];
  consumed: number[];
  reports: string[];
  turnsRun: string[];
  background: Promise<unknown>[];
};

type FakeOptions = {
  consented?: boolean;
  entitled?: boolean;
  dailyTurns?: number | null;
  turnsToday?: number;
  ownsConversation?: boolean;
  busy?: boolean;
  undo?: (actionId: string) => Promise<UndoResult>;
  runTurn?: RunTurn;
  signedIn?: boolean;
};

const unused = () => Promise.reject(new Error("the routes do not call this"));

function fake(options: FakeOptions = {}): Fake {
  const { consented = true, entitled = true, dailyTurns = 15, turnsToday = 0 } = options;
  const started: Started[] = [];
  const conversations: string[] = [];
  const consumed: number[] = [];
  const reports: string[] = [];
  const turnsRun: string[] = [];
  const background: Promise<unknown>[] = [];
  const access: AccessStore = {
    hasConsented: () => Promise.resolve(consented),
    hasEntitlement: () => Promise.resolve(entitled),
    dailyTurns: () => Promise.resolve(dailyTurns),
    consumeTurn: (_user, limit) => {
      consumed.push(limit);
      return Promise.resolve(consumed.length + turnsToday <= limit);
    },
    turnsStartedSince: () => Promise.resolve(turnsToday),
    spendThisMonth: () => Promise.resolve(0),
  };
  const turns: TurnStore = {
    createConversation: (user) => {
      conversations.push(user);
      return Promise.resolve(conversationId);
    },
    ownsConversation: () => Promise.resolve(options.ownsConversation ?? true),
    startTurn: (input) => {
      started.push(input);
      return options.busy === true
        ? Promise.reject(new ConversationBusyError())
        : Promise.resolve({ turnId, userMessageId });
    },
    // The routes only start turns. The loop of KEY-794 is what calls the rest.
    appendMessages: unused,
    setUserMessageContent: unused,
    readConversation: unused,
    readCompactionState: unused,
    storeCompaction: unused,
    readTimeZone: unused,
    finishTurn: unused,
    turnHasAction: unused,
  };
  const report: ReportError = (_functionName, code) => {
    reports.push(code);
  };
  const runTurn: RunTurn =
    options.runTurn ??
    ((context, stream) => {
      turnsRun.push(context.turnId);
      writeEvent(stream, {
        type: "turn",
        turnId: context.turnId,
        conversationId: context.conversationId,
      });
      writeEvent(stream, { type: "done", outcome: "complete" });
      return Promise.resolve();
    });
  const dependencies: AssistantDependencies = {
    authenticate: (_request) =>
      Promise.resolve(
        options.signedIn === false ? error("unauthorized", "Sign in.") : { id: userId },
      ),
    access,
    turns,
    undoWith: () => options.undo ?? (() => Promise.resolve({ status: "undone", actionId })),
    runTurn,
    runInBackground: (task) => {
      background.push(task);
    },
    now: () => new Date("2026-10-25T23:59:00Z"),
    report,
  };
  return { dependencies, started, conversations, consumed, reports, turnsRun, background };
}

const turnBody = {
  conversationId: null,
  text: secretText,
  localDate: "2026-10-25",
  localTime: null,
};

function call(
  dependencies: AssistantDependencies,
  route: string,
  init: { method?: string; body?: unknown } = {},
): Promise<Response> {
  const method = init.method ?? "POST";
  return createAssistantHandler(dependencies)(
    new Request(`http://localhost/functions/v1/assistant/${route}`, {
      method,
      headers: { "Content-Type": "application/json", Authorization: "Bearer token" },
      body: method === "GET" ? undefined : JSON.stringify(init.body ?? {}),
    }),
  );
}

async function eventsOf(response: Response) {
  const text = await response.text();
  return text
    .split("\n\n")
    .filter((block) => block !== "")
    .map((block) => JSON.parse(block.replace(/^data: /, "")));
}

Deno.test("every route answers a missing or bad sign-in with the 401 JSON", async () => {
  const { dependencies } = fake({ signedIn: false });
  for (const [route, method] of [
    ["status", "GET"],
    ["turn", "POST"],
    ["conversations", "POST"],
    ["undo", "POST"],
  ]) {
    const response = await call(dependencies, route, { method });
    assertEquals(response.status, 401);
    assertEquals((await response.json()).error.code, "unauthorized");
  }
});

Deno.test("an unknown route or the wrong method is a 404", async () => {
  const { dependencies } = fake();
  assertEquals((await call(dependencies, "nothing")).status, 404);
  assertEquals((await call(dependencies, "status")).status, 404);
  assertEquals((await call(dependencies, "turn", { method: "GET" })).status, 404);
});

Deno.test("status answers a null notice when the user may take a turn", async () => {
  const response = await call(fake().dependencies, "status", { method: "GET" });
  assertEquals(response.status, 200);
  assertEquals(await response.json(), { notice: null });
});

Deno.test("status answers the notice and never consumes a turn", async () => {
  const full = fake({ turnsToday: 15 });
  const noConsent = fake({ consented: false });

  const dayLimit = await (await call(full.dependencies, "status", { method: "GET" })).json();
  const consent = await (await call(noConsent.dependencies, "status", { method: "GET" })).json();

  assertEquals(dayLimit, { notice: { code: "day_limit", resetsAt: "2026-10-26T00:00:00Z" } });
  assertEquals(consent, { notice: { code: "consent_needed" } });
  assertEquals([full.consumed, noConsent.consumed], [[], []]);
});

Deno.test("a bad turn body is a 400 JSON before any gate runs", async () => {
  const { dependencies, consumed } = fake();
  for (const body of [{}, { ...turnBody, text: "" }, { ...turnBody, extra: true }]) {
    const response = await call(dependencies, "turn", { body });
    assertEquals(response.status, 400);
    assertEquals((await response.json()).error.code, "invalid_request");
  }
  assertEquals(consumed, []);
});

Deno.test(
  "a turn that fails a gate streams a notice then a failed done, and leaves no row",
  async () => {
    const cases = [
      { options: { consented: false }, notice: { code: "consent_needed" } },
      { options: { entitled: false }, notice: { code: "plus" } },
      {
        options: { turnsToday: 15 },
        notice: { code: "day_limit", resetsAt: "2026-10-26T00:00:00Z" },
      },
    ];
    for (const { options, notice } of cases) {
      const made = fake(options);

      const response = await call(made.dependencies, "turn", { body: turnBody });

      assertEquals(response.status, 200);
      assertEquals(response.headers.get("Content-Type"), "text/event-stream");
      assertEquals(await eventsOf(response), [
        { type: "notice", notice },
        { type: "done", outcome: "failed" },
      ]);
      assertEquals([made.started, made.conversations, made.turnsRun], [[], [], []]);
    }
  },
);

Deno.test(
  "every turn request hands its promise to runInBackground, which settles without rejecting",
  async () => {
    const cases: { options: FakeOptions; body: typeof turnBody | Record<string, unknown> }[] = [
      { options: {}, body: turnBody },
      { options: { consented: false }, body: turnBody },
      { options: { busy: true }, body: turnBody },
      { options: { ownsConversation: false }, body: { ...turnBody, conversationId } },
      { options: { runTurn: () => Promise.reject(new Error("boom")) }, body: turnBody },
    ];
    for (const { options, body } of cases) {
      const made = fake(options);

      const response = await call(made.dependencies, "turn", { body });
      await response.text();

      assertEquals(made.background.length, 1);
      await made.background[0];
    }
  },
);

Deno.test("the turn response returns before the background promise settles", async () => {
  const release = Promise.withResolvers<void>();
  const finished = Promise.withResolvers<void>();
  const made = fake({
    runTurn: async (context, stream) => {
      writeEvent(stream, {
        type: "turn",
        turnId: context.turnId,
        conversationId: context.conversationId,
      });
      await release.promise;
      writeEvent(stream, { type: "done", outcome: "complete" });
      finished.resolve();
    },
  });

  const response = await call(made.dependencies, "turn", { body: turnBody });
  const reader = response.body?.getReader();
  const first = await reader?.read();

  assertEquals(response.headers.get("Content-Type"), "text/event-stream");
  assertEquals(first?.done, false);
  assertEquals(made.background.length, 1);
  // The reader goes away while the turn is still running, and the turn goes on to its end.
  await reader?.cancel();
  release.resolve();
  await finished.promise;
  await made.background[0];
});

Deno.test("a refused first-three-gates turn consumes nothing", async () => {
  const noConsent = fake({ consented: false });
  const noPlan = fake({ entitled: false });

  await (await call(noConsent.dependencies, "turn", { body: turnBody })).text();
  await (await call(noPlan.dependencies, "turn", { body: turnBody })).text();

  assertEquals([noConsent.consumed, noPlan.consumed], [[], []]);
});

Deno.test(
  "a turn that passes the gates starts a conversation and a turn and runs the loop",
  async () => {
    const made = fake();

    const response = await call(made.dependencies, "turn", { body: turnBody });

    assertEquals(await eventsOf(response), [
      { type: "turn", turnId, conversationId },
      { type: "done", outcome: "complete" },
    ]);
    assertEquals(made.consumed, [15]);
    assertEquals(made.conversations, [userId]);
    assertEquals(made.started, [{ userId, conversationId, text: secretText }]);
  },
);

Deno.test("the turn loop gets the id of the user message the turn stored", async () => {
  const contexts: TurnContext[] = [];
  const { dependencies } = fake({
    runTurn: (context) => {
      contexts.push(context);
      return Promise.resolve();
    },
  });

  await (await call(dependencies, "turn", { body: turnBody })).text();

  assertEquals(
    contexts.map((context) => context.userMessageId),
    [userMessageId],
  );
});

Deno.test("the turn loop gets the entry the app sent, and none when it sent none", async () => {
  const contexts: TurnContext[] = [];
  const { dependencies } = fake({
    runTurn: (context) => {
      contexts.push(context);
      return Promise.resolve();
    },
  });

  await (await call(dependencies, "turn", { body: { ...turnBody, entry: "plan" } })).text();
  await (await call(dependencies, "turn", { body: turnBody })).text();

  assertEquals(
    contexts.map((context) => context.entry),
    ["plan", undefined],
  );
  assertEquals("entry" in (contexts[1] ?? {}), false);
});

Deno.test("a turn in an existing conversation does not create another", async () => {
  const made = fake();

  const response = await call(made.dependencies, "turn", {
    body: { ...turnBody, conversationId },
  });
  await response.text();

  assertEquals(made.conversations, []);
  assertEquals(made.started.length, 1);
});

Deno.test("a conversation that is not the caller's fails the turn and starts none", async () => {
  const made = fake({ ownsConversation: false });

  const response = await call(made.dependencies, "turn", {
    body: { ...turnBody, conversationId },
  });

  assertEquals(await eventsOf(response), [
    { type: "notice", notice: { code: "turn_failed" } },
    { type: "done", outcome: "failed" },
  ]);
  assertEquals(made.started, []);
});

Deno.test("a busy conversation fails the turn with a notice and no turn event", async () => {
  const made = fake({ busy: true });
  const spy = spyOnConsole();
  try {
    const response = await call(made.dependencies, "turn", {
      body: { ...turnBody, conversationId },
    });
    assertEquals(await eventsOf(response), [
      { type: "notice", notice: { code: "turn_failed" } },
      { type: "done", outcome: "failed" },
    ]);
  } finally {
    spy.restore();
  }

  assertEquals(made.turnsRun, []);
  assertEquals(made.reports, []);
  assertEquals(spy.lines.filter((line) => line.includes("gate=conversation_busy")).length, 1);
  assertEquals(
    spy.lines.filter((line) => line.includes(secretText)),
    [],
  );
});

Deno.test("a loop that throws is reported and ends the turn as failed", async () => {
  const made = fake({
    runTurn: (_context, stream) => {
      writeEvent(stream, { type: "text", delta: "partial" });
      return Promise.reject(new Error(secretText));
    },
  });

  const response = await call(made.dependencies, "turn", { body: turnBody });

  assertEquals(await eventsOf(response), [
    { type: "text", delta: "partial" },
    { type: "notice", notice: { code: "turn_failed" } },
    { type: "done", outcome: "failed" },
  ]);
  assertEquals(made.reports, ["internal_error"]);
});

Deno.test("conversations creates an empty one for the verified user", async () => {
  const made = fake();

  const response = await call(made.dependencies, "conversations", { body: { userId: "other" } });

  assertEquals(response.status, 200);
  assertEquals(await response.json(), { conversationId });
  assertEquals(made.conversations, [userId]);
});

Deno.test("undo answers each id with a code", async () => {
  const ids = [1, 2, 3, 4, 5].map((n) => `00000000-0000-4000-8000-00000000000${n}`);
  const outcomes: UndoResult[] = [
    { status: "undone", actionId: ids[0] ?? "" },
    { status: "error", code: "already_undone" },
    { status: "error", code: "undo_unavailable" },
    { status: "error", code: "not_found" },
    { status: "error", code: "undo_failed" },
  ];
  const made = fake({
    undo: (id) =>
      Promise.resolve(outcomes[ids.indexOf(id)] ?? { status: "error", code: "not_found" }),
  });

  const response = await call(made.dependencies, "undo", { body: { actionIds: ids } });

  assertEquals(response.status, 200);
  assertEquals(await response.json(), {
    results: [
      { actionId: ids[0], result: "undone" },
      { actionId: ids[1], result: "already_undone" },
      { actionId: ids[2], result: "undo_unavailable" },
      { actionId: ids[3], result: "not_found" },
      { actionId: ids[4], result: "undo_unavailable" },
    ],
  });
});

Deno.test("undo passes the reason of an unavailable undo beside its result", async () => {
  const ids = [1, 2].map((n) => `00000000-0000-4000-8000-00000000000${n}`);
  const made = fake({
    undo: (id) =>
      Promise.resolve(
        id === ids[0]
          ? { status: "error", code: "undo_unavailable", reason: "workout_in_progress" }
          : { status: "error", code: "undo_unavailable" },
      ),
  });

  const response = await call(made.dependencies, "undo", { body: { actionIds: ids } });

  assertEquals(await response.json(), {
    results: [
      { actionId: ids[0], result: "undo_unavailable", reason: "workout_in_progress" },
      { actionId: ids[1], result: "undo_unavailable" },
    ],
  });
});

Deno.test("undo refuses a body that is not a list of ids", async () => {
  const { dependencies } = fake();
  for (const body of [{}, { actionIds: [] }, { actionIds: ["not-an-id"] }]) {
    assertEquals((await call(dependencies, "undo", { body })).status, 400);
  }
});

Deno.test("no log line holds the message text, whichever way the turn ends", async () => {
  const spy = spyOnConsole();
  try {
    for (const options of [
      {},
      { consented: false },
      { ownsConversation: false },
      { runTurn: () => Promise.reject(new Error(secretText)) },
    ]) {
      const body = {
        ...turnBody,
        conversationId: options.ownsConversation === false ? conversationId : null,
      };
      await (await call(fake(options).dependencies, "turn", { body })).text();
    }
  } finally {
    spy.restore();
  }

  assertEquals(spy.lines.length > 0, true);
  assertEquals(
    spy.lines.filter((line) => line.includes(secretText)),
    [],
  );
  assertEquals(spy.lines.filter((line) => line.includes(userId)).length > 0, true);
});
