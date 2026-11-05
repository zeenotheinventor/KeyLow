import { describe, expect, it, vi } from "vitest";

import { costing, scriptedStack } from "./helpers.ts";
import { runCli } from "../src/cli.ts";

import type { ScriptedTurn } from "./helpers.ts";
import type { EvalCase } from "../src/case.ts";
import type { EvalSession } from "../src/cli.ts";

const withKey = { ANTHROPIC_API_KEY: "key-for-tests" };

const caseOf = (id: string, set: EvalCase["set"], overrides: Partial<EvalCase> = {}): EvalCase => ({
  id,
  set,
  messages: ["hello"],
  expect: [],
  ...overrides,
});

/** A session whose turns cost the given numbers of input tokens, one turn for each number. */
function sessionCosting(turnCosts: number[], close = vi.fn(() => Promise.resolve())) {
  const script: ScriptedTurn[] = turnCosts.map((tokens) => costing(tokens));
  const stack = scriptedStack(script);
  const session: EvalSession = { ...stack, close };
  return { session, driver: stack.driver, close };
}

describe("runCli with no key", () => {
  it("should fail with a message that names the key, and not open a session", async () => {
    const openSession = vi.fn();

    const output = await runCli([], {}, { cases: [caseOf("a", "ask")], openSession });

    expect(output.exitCode).toBe(1);
    expect(output.stderr).toContain("ANTHROPIC_API_KEY is not set");
    expect(output.stdout).toBe("");
    expect(openSession).not.toHaveBeenCalled();
  });

  it("should print no stack trace", async () => {
    const output = await runCli([], {}, { cases: [], openSession: vi.fn() });

    expect(output.stderr).not.toMatch(/\bat .*\(|\.ts:\d+/);
  });

  it("should treat a blank key as unset", async () => {
    const output = await runCli(
      [],
      { ANTHROPIC_API_KEY: "  " },
      { cases: [], openSession: vi.fn() },
    );

    expect(output.stderr).toContain("ANTHROPIC_API_KEY is not set");
  });
});

describe("runCli --help", () => {
  it("should print the options and say what the budget counts, even with no key", async () => {
    const output = await runCli(["--help"], {}, { cases: [], openSession: vi.fn() });

    expect(output.exitCode).toBe(0);
    expect(output.stdout).toContain("--budget <tokens>");
    expect(output.stdout).toContain("input, output and cache creation tokens");
    expect(output.stdout).toContain("Cache read tokens are reported but not counted");
    expect(output.stdout).toContain("300000");
  });
});

describe("runCli arguments", () => {
  const dependencies = { cases: [caseOf("a", "ask")], openSession: vi.fn() };

  it.each([
    [["--budget", "abc"], "--budget must be a whole number of tokens above 0"],
    [["--budget", "0"], "--budget must be a whole number of tokens above 0"],
    [["--budget=-5"], "--budget must be a whole number of tokens above 0"],
    [["--budget", "1.5"], "--budget must be a whole number of tokens above 0"],
    [
      ["--set", "nonsense"],
      'Unknown set "nonsense". The sets are ask, describe, redTeam, compaction, writes, recipes.',
    ],
    [["--surprise"], "Unknown or incomplete option."],
  ])("should refuse %j with a clear message", async (argv, message) => {
    const output = await runCli(argv, withKey, dependencies);

    expect(output.exitCode).toBe(1);
    expect(output.stderr).toContain(message);
    expect(dependencies.openSession).not.toHaveBeenCalled();
  });

  it("should ignore the lone double dash that pnpm passes on", async () => {
    const { session } = sessionCosting([1]);

    const output = await runCli(["--", "--set", "ask"], withKey, {
      cases: [caseOf("a", "ask")],
      openSession: () => Promise.resolve(session),
    });

    expect(output.exitCode).toBe(0);
  });
});

describe("runCli with no cases", () => {
  it("should fail rather than report a pass for a run that ran nothing", async () => {
    const openSession = vi.fn();

    const output = await runCli([], withKey, { cases: [], openSession });

    expect(output.exitCode).toBe(1);
    expect(output.stderr).toContain("No eval cases are registered for ask, describe, redTeam");
    expect(openSession).not.toHaveBeenCalled();
  });

  it("should name only the selected sets", async () => {
    const output = await runCli(["--set", "redTeam"], withKey, {
      cases: [caseOf("a", "ask")],
      openSession: vi.fn(),
    });

    expect(output.stderr).toContain("No eval cases are registered for redTeam");
  });
});

describe("runCli run", () => {
  it("should print each set's pass rate and exit 0 when every set meets its threshold", async () => {
    const { session } = sessionCosting([1]);

    const output = await runCli([], withKey, {
      cases: [caseOf("a", "ask")],
      openSession: () => Promise.resolve(session),
    });

    expect(output.exitCode).toBe(0);
    expect(output.stdout).toContain("ask: 1 of 1 passed (100%), threshold 90%, met");
  });

  it("should say which selected sets have no cases", async () => {
    const { session } = sessionCosting([1]);

    const output = await runCli([], withKey, {
      cases: [caseOf("a", "ask")],
      openSession: () => Promise.resolve(session),
    });

    expect(output.stdout).toContain("describe: no cases");
    expect(output.stdout).toContain("redTeam: no cases");
  });

  it("should exit non-zero when a set is below its threshold", async () => {
    const { session } = sessionCosting([1]);
    const failing = caseOf("b", "redTeam", {
      expect: [() => Promise.resolve({ passed: false, reason: "it answered" })],
    });

    const output = await runCli([], withKey, {
      cases: [failing],
      openSession: () => Promise.resolve(session),
    });

    expect(output.exitCode).not.toBe(0);
    expect(output.stdout).toContain("redTeam: 0 of 1 passed (0%), threshold 100%, NOT met");
    expect(output.stdout).toContain("failed b: it answered");
  });

  it("should run only the selected sets", async () => {
    const { session, driver } = sessionCosting([1]);

    await runCli(["--set", "describe"], withKey, {
      cases: [caseOf("a", "ask"), caseOf("d", "describe")],
      openSession: () => Promise.resolve(session),
    });

    expect(driver.sent).toHaveLength(1);
  });

  it("should stop at the budget it is given and exit non-zero when a set falls short", async () => {
    const { session, driver } = sessionCosting([100, 100, 100]);

    const output = await runCli(["--budget", "250"], withKey, {
      cases: [caseOf("a", "ask"), caseOf("b", "ask"), caseOf("c", "ask")],
      openSession: () => Promise.resolve(session),
    });

    expect(driver.sent).toHaveLength(2);
    expect(output.exitCode).not.toBe(0);
    expect(output.stdout).toContain("Stopped at the token budget: 1 case was not run.");
  });

  it("should exit 0 after a budget stop that leaves every set at its threshold", async () => {
    const { session } = sessionCosting(Array.from({ length: 9 }, () => 10));
    const cases = Array.from({ length: 10 }, (_, index) => caseOf(`case-${index}`, "ask"));

    const output = await runCli(["--budget", "95"], withKey, {
      cases,
      openSession: () => Promise.resolve(session),
    });

    expect(output.stdout).toContain("ask: 9 of 10 passed (90%), threshold 90%, met");
    expect(output.exitCode).toBe(0);
  });

  it("should exit non-zero and say so loudly when a turn took the run over its budget", async () => {
    const { session } = sessionCosting([500]);

    const output = await runCli(["--budget", "100"], withKey, {
      cases: [caseOf("a", "ask")],
      openSession: () => Promise.resolve(session),
    });

    expect(output.exitCode).not.toBe(0);
    expect(output.stdout).toContain("OVER BUDGET: 500 tokens used, the budget was 100.");
  });

  it("should default the budget to 300000 tokens", async () => {
    const { session, driver } = sessionCosting([200_000, 200_000]);

    const output = await runCli([], withKey, {
      cases: [caseOf("a", "ask"), caseOf("b", "ask")],
      openSession: () => Promise.resolve(session),
    });

    expect(driver.sent).toHaveLength(1);
    expect(output.stdout).toContain("Tokens used: 200000 of 300000");
  });

  it("should close the session when the run is over", async () => {
    const { session, close } = sessionCosting([1]);

    await runCli([], withKey, {
      cases: [caseOf("a", "ask")],
      openSession: () => Promise.resolve(session),
    });

    expect(close).toHaveBeenCalledOnce();
  });

  it("should still print the report when the session cannot be closed, and warn", async () => {
    const { session } = sessionCosting(
      [1],
      vi.fn(() => Promise.reject(new Error("could not delete the user"))),
    );

    const output = await runCli([], withKey, {
      cases: [caseOf("a", "ask")],
      openSession: () => Promise.resolve(session),
    });

    expect(output.exitCode).toBe(0);
    expect(output.stdout).toContain("ask: 1 of 1 passed");
    expect(output.stderr).toContain(
      "The eval session did not close cleanly: could not delete the user",
    );
  });

  it("should never print the key", async () => {
    const { session } = sessionCosting([1]);

    const output = await runCli([], withKey, {
      cases: [caseOf("a", "ask")],
      openSession: () => Promise.resolve(session),
    });

    expect(output.stdout + output.stderr).not.toContain(withKey.ANTHROPIC_API_KEY);
  });

  it("should report a session that cannot be opened as a message, not a stack trace", async () => {
    const output = await runCli([], withKey, {
      cases: [caseOf("a", "ask")],
      openSession: () => Promise.reject(new Error("The local stack is not running")),
    });

    expect(output.exitCode).toBe(1);
    expect(output.stderr).toContain(
      "Could not start the eval session: The local stack is not running",
    );
  });
});
