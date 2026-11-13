import { assertEquals } from "@std/assert";

import { allowedLogKeys, logLine } from "./log.ts";
import { spyOnConsole } from "./assistant/testing.ts";

const userId = "0c5f8d4e-6b1a-4c3e-9d2f-7a8b9c0d1e2f";

function lineOf(write: () => void): string[] {
  const spy = spyOnConsole();
  try {
    write();
  } finally {
    spy.restore();
  }
  return spy.lines;
}

Deno.test("logLine writes the event and the fields as key=value pairs", () => {
  assertEquals(
    lineOf(() => logLine("info", "mcp call", { user: userId, tool: "get_day", code: "ok" })),
    [`mcp call user=${userId} tool=get_day code=ok`],
  );
});

Deno.test("logLine writes the duration last, as milliseconds with a unit", () => {
  assertEquals(
    lineOf(() => logLine("info", "mcp gate", { milliseconds: 12, user: userId, gate: "ok" })),
    [`mcp gate user=${userId} gate=ok 12ms`],
  );
});

Deno.test("logLine writes counts as numbers", () => {
  assertEquals(
    lineOf(() => logLine("info", "run-checkin backstop", { users: 3, ran: 5, failed: 1 })),
    ["run-checkin backstop users=3 ran=5 failed=1"],
  );
});

Deno.test("logLine writes an event with no fields as the event alone", () => {
  assertEquals(
    lineOf(() => logLine("warn", "assistant replay")),
    ["assistant replay"],
  );
});

Deno.test("logLine skips a field whose value is undefined", () => {
  assertEquals(
    lineOf(() =>
      logLine("info", "off-product refresh", { code: "refresh_failed", status: undefined }),
    ),
    ["off-product refresh code=refresh_failed"],
  );
});

Deno.test("logLine writes each level through the console method of that name", () => {
  const written: string[] = [];
  const originals = { info: console.info, warn: console.warn, error: console.error };
  console.info = () => written.push("info");
  console.warn = () => written.push("warn");
  console.error = () => written.push("error");
  try {
    logLine("info", "a");
    logLine("warn", "b");
    logLine("error", "c");
  } finally {
    Object.assign(console, originals);
  }
  assertEquals(written, ["info", "warn", "error"]);
});

Deno.test("logLine refuses a key outside the allow list, by type and at run time", () => {
  const lines = lineOf(() =>
    logLine("info", "mcp call", {
      user: userId,
      // @ts-expect-error a food name is not an allowed key, so the compiler refuses it
      foodName: "Chicken breast",
    }),
  );

  assertEquals(lines, [`mcp call user=${userId}`]);
});

Deno.test("logLine refuses a string where a count belongs", () => {
  const lines = lineOf(() =>
    // @ts-expect-error a count is a number, so a string cannot carry free text there
    logLine("info", "run", { ran: "82.4 kg" }),
  );

  assertEquals(lines, ["run"]);
});

Deno.test("a text value that does not have the shape of its key is written as unknown", () => {
  assertEquals(
    lineOf(() =>
      logLine("info", "x", {
        user: "not-a-uuid",
        code: "Chicken breast 82.4 kg",
        result: "a".repeat(65),
        tool: "Get Day",
        errorType: "",
      }),
    ),
    ["x user=unknown code=unknown result=unknown tool=unknown errorType=unknown"],
  );
});

Deno.test("a code of the allowed characters, up to 64 long, is kept", () => {
  const longest = "a".repeat(64);
  assertEquals(
    lineOf(() =>
      logLine("info", "x", { code: longest, step: "retry:1", model: "claude-sonnet-5-5" }),
    ),
    [`x code=${longest} step=retry:1 model=claude-sonnet-5-5`],
  );
});

Deno.test("a function name may hold spaces, which are written as underscores", () => {
  assertEquals(
    lineOf(() => logLine("error", "report", { function: "assistant tool copy_day" })),
    ["report function=assistant_tool_copy_day"],
  );
});

Deno.test("logLine drops an extra key named like an inherited property and does not throw", () => {
  const lines = lineOf(() =>
    logLine("info", "x", {
      code: "ok",
      // @ts-expect-error not an allowed key, and an inherited name must not pass for one
      constructor: "boom",
      // @ts-expect-error not an allowed key, and an inherited name must not pass for one
      toString: "boom",
    }),
  );

  assertEquals(lines, ["x code=ok"]);
});

Deno.test("the allow list is exactly the keys the functions log", () => {
  assertEquals(
    [...allowedLogKeys].sort(),
    [
      "branch",
      "code",
      "conversation",
      "ending",
      "failed",
      "function",
      "gate",
      "milliseconds",
      "model",
      "modelCalls",
      "noteTokens",
      "promptTokens",
      "ran",
      "result",
      "route",
      "status",
      "step",
      "tool",
      "toolCalls",
      "transport",
      "turn",
      "user",
      "users",
      "errorType",
    ].sort(),
  );
});
