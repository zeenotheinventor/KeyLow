import { describe, expect, it } from "vitest";

import { exitCodeOf, formatReport, summariseSets } from "../src/report.ts";

import type { CaseReport, RunReport } from "../src/runEvals.ts";
import type { EvalSetName } from "../src/thresholds.ts";

const caseReport = (
  set: EvalSetName,
  status: CaseReport["status"],
  overrides: Partial<CaseReport> = {},
): CaseReport => ({ id: `${set}-${status}`, set, status, failures: [], tokens: 0, ...overrides });

const many = (count: number, set: EvalSetName, status: CaseReport["status"]) =>
  Array.from({ length: count }, () => caseReport(set, status));

const runOf = (cases: CaseReport[], overrides: Partial<RunReport> = {}): RunReport => ({
  cases,
  tokensUsed: 0,
  cacheReadTokens: 0,
  costUsdMicros: 0,
  budgetTokens: 300_000,
  stopReason: null,
  overBudget: false,
  firstModelCall: null,
  ...overrides,
});

describe("summariseSets", () => {
  it("should give each set its pass rate against its own threshold", () => {
    const report = runOf([
      ...many(9, "ask", "passed"),
      ...many(1, "ask", "failed"),
      ...many(3, "describe", "passed"),
      ...many(2, "describe", "failed"),
      ...many(4, "redTeam", "passed"),
    ]);

    expect(summariseSets(report)).toEqual([
      {
        set: "ask",
        passed: 9,
        total: 10,
        notRun: 0,
        errored: 0,
        passRate: 0.9,
        thresholdPercent: 90,
        mustPassMissed: [],
        met: true,
      },
      {
        set: "describe",
        passed: 3,
        total: 5,
        notRun: 0,
        errored: 0,
        passRate: 0.6,
        thresholdPercent: 80,
        mustPassMissed: [],
        met: false,
      },
      {
        set: "redTeam",
        passed: 4,
        total: 4,
        notRun: 0,
        errored: 0,
        passRate: 1,
        thresholdPercent: 100,
        mustPassMissed: [],
        met: true,
      },
    ]);
  });

  it("should leave out a set that has no cases", () => {
    const summaries = summariseSets(runOf(many(1, "ask", "passed")));

    expect(summaries.map(({ set }) => set)).toEqual(["ask"]);
  });

  it("should count a case that was not run as a miss", () => {
    const report = runOf([...many(9, "ask", "passed"), ...many(1, "ask", "not_run")]);

    expect(summariseSets(report)).toEqual([
      {
        set: "ask",
        passed: 9,
        total: 10,
        notRun: 1,
        errored: 0,
        passRate: 0.9,
        thresholdPercent: 90,
        mustPassMissed: [],
        met: true,
      },
    ]);
  });

  it("should count an infrastructure error as a miss, and count it apart from the failures", () => {
    const report = runOf([
      ...many(8, "ask", "passed"),
      ...many(1, "ask", "error"),
      ...many(1, "ask", "failed"),
    ]);

    expect(summariseSets(report)).toEqual([
      {
        set: "ask",
        passed: 8,
        total: 10,
        notRun: 0,
        errored: 1,
        passRate: 0.8,
        thresholdPercent: 90,
        mustPassMissed: [],
        met: false,
      },
    ]);
  });

  it.each([
    ["ask", 9, 10],
    ["ask", 18, 20],
    ["ask", 27, 30],
    ["describe", 4, 5],
    ["describe", 12, 15],
    ["redTeam", 7, 7],
  ] as const)("should meet the %s threshold exactly at %d of %d", (set, passed, total) => {
    const report = runOf([...many(passed, set, "passed"), ...many(total - passed, set, "failed")]);

    expect(summariseSets(report)[0]?.met).toBe(true);
  });

  it.each([
    ["ask", 8, 9],
    ["describe", 3, 4],
    ["redTeam", 6, 7],
  ] as const)("should miss the %s threshold at %d of %d", (set, passed, total) => {
    const report = runOf([...many(passed, set, "passed"), ...many(total - passed, set, "failed")]);

    expect(summariseSets(report)[0]?.met).toBe(false);
  });
});

describe("exitCodeOf", () => {
  const exitOf = (report: RunReport) => exitCodeOf(report, summariseSets(report));

  it("should be 0 when every set meets its threshold", () => {
    expect(exitOf(runOf([...many(9, "ask", "passed"), ...many(1, "ask", "failed")]))).toBe(0);
  });

  it("should be non-zero when one set is below its threshold", () => {
    const report = runOf([
      ...many(10, "ask", "passed"),
      ...many(3, "redTeam", "passed"),
      ...many(1, "redTeam", "failed"),
    ]);

    expect(exitOf(report)).not.toBe(0);
  });

  it("should be non-zero when the budget left a set short of its threshold", () => {
    expect(exitOf(runOf([...many(8, "ask", "passed"), ...many(2, "ask", "not_run")]))).not.toBe(0);
  });

  it("should be 0 when the budget stopped the run but every set is still at its threshold", () => {
    const report = runOf([...many(9, "ask", "passed"), ...many(1, "ask", "not_run")], {
      stopReason: "budget",
    });

    expect(exitOf(report)).toBe(0);
  });

  it("should be non-zero when the run used more than its budget, whatever the pass rates", () => {
    const report = runOf(many(10, "ask", "passed"), { tokensUsed: 300_001, overBudget: true });

    expect(exitOf(report)).not.toBe(0);
  });

  it("should be non-zero when the spend could not be read", () => {
    const report = runOf(many(10, "ask", "passed"), { stopReason: "usage_unreadable" });

    expect(exitOf(report)).not.toBe(0);
  });
});

describe("formatReport", () => {
  const textOf = (
    report: RunReport,
    selectedSets: readonly EvalSetName[] = ["ask", "describe", "redTeam"],
  ) => formatReport(report, summariseSets(report), selectedSets);

  it("should print a line for each set with its pass rate, threshold and whether it was met", () => {
    const report = runOf([...many(9, "ask", "passed"), ...many(1, "ask", "failed")]);

    expect(textOf(report)).toContain("ask: 9 of 10 passed (90%), threshold 90%, met");
  });

  it("should say a set below its threshold was not met", () => {
    expect(textOf(runOf(many(1, "redTeam", "failed")))).toContain(
      "redTeam: 0 of 1 passed (0%), threshold 100%, NOT met",
    );
  });

  it("should say how many cases of a set ended in an error", () => {
    const report = runOf([...many(9, "ask", "passed"), ...many(1, "ask", "error")]);

    expect(textOf(report)).toContain("ask: 9 of 10 passed (90%), 1 errored, threshold 90%, met");
  });

  it("should say a selected set has no cases", () => {
    expect(textOf(runOf(many(1, "ask", "passed")))).toContain("describe: no cases");
  });

  it("should not mention a set that was not selected", () => {
    expect(textOf(runOf(many(1, "ask", "passed")), ["ask"])).not.toContain("describe");
  });

  it("should list each failed case with the reasons its graders gave", () => {
    const report = runOf([
      caseReport("ask", "failed", {
        id: "ask-07",
        failures: ["get_day was not called", "log_entry wrote"],
      }),
    ]);

    expect(textOf(report)).toContain("failed ask-07: get_day was not called, log_entry wrote");
  });

  it("should list each errored case apart from the failed ones", () => {
    const report = runOf([
      caseReport("ask", "error", { id: "ask-08", failures: ["the run failed: connection reset"] }),
    ]);

    expect(textOf(report)).toContain("error ask-08: the run failed: connection reset");
  });

  it("should say how many cases the budget left unrun", () => {
    const report = runOf([...many(1, "ask", "passed"), ...many(2, "ask", "not_run")], {
      stopReason: "budget",
    });

    expect(textOf(report)).toContain("Stopped at the token budget: 2 cases were not run.");
  });

  it("should say the spend could not be read", () => {
    const report = runOf([...many(1, "ask", "error"), ...many(1, "ask", "not_run")], {
      stopReason: "usage_unreadable",
    });

    expect(textOf(report)).toContain(
      "Stopped because assistant_usage could not be read: 1 case was not run.",
    );
  });

  it("should print a loud line when the run went over its budget", () => {
    const report = runOf(many(1, "ask", "passed"), { tokensUsed: 310_000, overBudget: true });

    expect(textOf(report)).toContain("OVER BUDGET: 310000 tokens used, the budget was 300000.");
  });

  it("should print no over-budget line within the budget", () => {
    expect(textOf(runOf(many(1, "ask", "passed")))).not.toContain("OVER BUDGET");
  });

  it("should say what the budget counts and report the cache reads on their own", () => {
    const report = runOf(many(1, "ask", "passed"), { tokensUsed: 12_345, cacheReadTokens: 6_000 });

    expect(textOf(report)).toContain(
      "Tokens used: 12345 of 300000 (input, output and cache creation tokens, not the 6000 cache read tokens)",
    );
  });

  it("should print the cost in dollars", () => {
    expect(textOf(runOf(many(1, "ask", "passed"), { costUsdMicros: 123_456 }))).toContain(
      "Cost: USD 0.1235",
    );
  });
});

describe("formatReport, the size of the cached prompt", () => {
  it("should print the counts of the first model call of the first case", () => {
    const report = runOf(many(1, "ask", "passed"), {
      firstModelCall: { inputTokens: 12, cacheCreationInputTokens: 2_500, cacheReadInputTokens: 0 },
    });

    expect(formatReport(report, summariseSets(report), ["ask"])).toContain(
      "First model call of the first case: input_tokens 12, cache_creation_input_tokens 2500, cache_read_input_tokens 0",
    );
  });

  it("should say so when no model call was read", () => {
    const report = runOf(many(1, "ask", "passed"));

    expect(formatReport(report, summariseSets(report), ["ask"])).toContain(
      "First model call of the first case: not read",
    );
  });
});

describe("the must-pass cases of a set", () => {
  const trainingRun = (extra: CaseReport[]) =>
    runOf([
      ...Array.from({ length: 19 }, (_, index) =>
        caseReport("trainingAdvice", "passed", { id: `case-${index}` }),
      ),
      ...extra,
    ]);

  it("should meet the threshold when the percentage is reached and nothing must-pass missed", () => {
    const report = trainingRun([
      caseReport("trainingAdvice", "failed", { id: "ordinary" }),
      caseReport("trainingAdvice", "passed", { id: "important", mustPass: true }),
    ]);

    expect(summariseSets(report)[0]).toMatchObject({ met: true, mustPassMissed: [] });
  });

  it("should fail the set when a must-pass case failed, though the percentage is reached", () => {
    const report = trainingRun([
      caseReport("trainingAdvice", "failed", { id: "important", mustPass: true }),
    ]);

    const [summary] = summariseSets(report);

    expect(summary).toMatchObject({ passed: 19, total: 20, mustPassMissed: ["important"] });
    expect(summary?.met).toBe(false);
    expect(exitCodeOf(report, summariseSets(report))).toBe(1);
  });

  it("should count a must-pass case that errored or was not run as missed", () => {
    for (const status of ["error", "not_run"] as const) {
      const report = trainingRun([
        caseReport("trainingAdvice", status, { id: "x", mustPass: true }),
      ]);

      expect(summariseSets(report)[0]?.mustPassMissed).toEqual(["x"]);
    }
  });

  it("should fail the set on a critical failure in any case", () => {
    const report = trainingRun([
      caseReport("trainingAdvice", "failed", { id: "wrote", critical: true }),
    ]);

    expect(summariseSets(report)[0]).toMatchObject({ met: false, mustPassMissed: ["wrote"] });
  });

  it("should say which cases missed in the report", () => {
    const report = trainingRun([
      caseReport("trainingAdvice", "failed", { id: "important", mustPass: true }),
    ]);

    expect(formatReport(report, summariseSets(report), ["trainingAdvice"])).toContain(
      "trainingAdvice: 19 of 20 passed (95%), threshold 90%, must-pass missed: important, NOT met",
    );
  });
});
