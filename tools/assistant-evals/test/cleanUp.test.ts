import { describe, expect, it } from "vitest";

import { fakeEnvironment } from "./fakeEnvironment.ts";
import { costing, scriptedStack } from "./helpers.ts";
import { runEvals } from "../src/runEvals.ts";

import type { EvalCase } from "../src/case.ts";

const oneTurnCase = (overrides: Partial<EvalCase> = {}): EvalCase => ({
  id: "writes-today",
  set: "ask",
  messages: ["I had a banana."],
  expect: [],
  ...overrides,
});

describe("runEvals with a case that cleans up", () => {
  it("should clean up after the graders have read the database", async () => {
    const log: string[] = [];
    const stack = scriptedStack([costing(1)]);

    await runEvals({
      cases: [
        oneTurnCase({
          expect: [
            () => {
              log.push("grade");
              return Promise.resolve({ passed: true, reason: "" });
            },
          ],
          cleanUp: () => {
            log.push("clean up");
            return Promise.resolve();
          },
        }),
      ],
      ...stack,
      environment: fakeEnvironment(),
      budgetTokens: 1_000_000,
    });

    expect(log).toEqual(["grade", "clean up"]);
  });

  it("should hand the cleanUp the turns that were sent and the environment", async () => {
    const stack = scriptedStack([costing(1, { turnId: "turn-a" })]);
    const environment = fakeEnvironment();
    const seen: string[] = [];

    await runEvals({
      cases: [
        oneTurnCase({
          cleanUp: async (turns, caseEnvironment) => {
            seen.push(...turns.map(({ turnId }) => turnId));
            await caseEnvironment.restoreTargets();
          },
        }),
      ],
      ...stack,
      environment,
      budgetTokens: 1_000_000,
    });

    expect(seen).toEqual(["turn-a"]);
    expect(environment.calls).toEqual(["restore targets"]);
  });

  it("should clean up when a turn failed, so a write that landed before the failure is put back", async () => {
    const stack = scriptedStack([costing(1, { turnId: "turn-failed", status: "failed" })]);
    const environment = fakeEnvironment();

    const report = await runEvals({
      cases: [
        oneTurnCase({
          cleanUp: async ({ length }, caseEnvironment) => {
            expect(length).toBe(1);
            await caseEnvironment.restoreTargets();
          },
        }),
      ],
      ...stack,
      environment,
      budgetTokens: 1_000_000,
    });

    expect(report.cases[0]?.status).toBe("error");
    expect(environment.calls).toEqual(["restore targets"]);
  });

  it("should end the case as an error when the cleanUp fails, naming the failure", async () => {
    const stack = scriptedStack([costing(1)]);

    const report = await runEvals({
      cases: [oneTurnCase({ cleanUp: () => Promise.reject(new Error("Undo answered 500")) })],
      ...stack,
      environment: fakeEnvironment(),
      budgetTokens: 1_000_000,
    });

    expect(report.cases[0]).toMatchObject({
      status: "error",
      failures: ["the run failed: Undo answered 500"],
    });
  });

  it("should end the case as an error when it needs a cleanUp environment the session does not have", async () => {
    const stack = scriptedStack([costing(1)]);

    const report = await runEvals({
      cases: [oneTurnCase({ cleanUp: () => Promise.resolve() })],
      ...stack,
      budgetTokens: 1_000_000,
    });

    expect(report.cases[0]).toMatchObject({
      status: "error",
      failures: ["the case needs a session with a case environment"],
    });
  });
});
