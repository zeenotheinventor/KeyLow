import { EVAL_SET_NAMES, THRESHOLD_PERCENT } from "./thresholds.ts";

import type { RunReport } from "./runEvals.ts";
import type { EvalSetName } from "./thresholds.ts";

export type SetSummary = Readonly<{
  set: EvalSetName;
  passed: number;
  total: number;
  notRun: number;
  errored: number;
  passRate: number;
  thresholdPercent: number;
  /** The cases whose miss fails the set whatever the percentage: a must-pass case not passed, or a critical failure. */
  mustPassMissed: readonly string[];
  /** True when the percentage is reached and no must-pass case or critical grader missed. */
  met: boolean;
}>;

/**
 * One summary for each set that has cases. A case the run stopped before and a case that ended in an error
 * both count in the total and not among the passes, because a run that skipped or lost cases has not shown
 * the threshold is met.
 */
export function summariseSets(report: RunReport): SetSummary[] {
  return EVAL_SET_NAMES.flatMap((set) => {
    const cases = report.cases.filter((evalCase) => evalCase.set === set);
    if (cases.length === 0) {
      return [];
    }
    const passed = cases.filter(({ status }) => status === "passed").length;
    const thresholdPercent = THRESHOLD_PERCENT[set];
    const mustPassMissed = cases
      .filter(
        ({ status, mustPass, critical, softOnly }) =>
          (mustPass === true && status !== "passed" && softOnly !== true) || critical === true,
      )
      .map(({ id }) => id);
    return [
      {
        set,
        passed,
        total: cases.length,
        notRun: cases.filter(({ status }) => status === "not_run").length,
        errored: cases.filter(({ status }) => status === "error").length,
        passRate: passed / cases.length,
        thresholdPercent,
        mustPassMissed,
        // Whole numbers on both sides, so the boundary is exact.
        met: passed * 100 >= thresholdPercent * cases.length && mustPassMissed.length === 0,
      },
    ];
  });
}

/**
 * 0 when every set meets its threshold, the run stayed within its budget and the spend could be read, and 1
 * otherwise. A budget stop alone is not a failure: it leaves unrun cases as misses, and if the sets still meet
 * their thresholds then, the run proved what it had to.
 */
export const exitCodeOf = (report: RunReport, summaries: readonly SetSummary[]): number =>
  summaries.every(({ met }) => met) &&
  !report.overBudget &&
  report.stopReason !== "usage_unreadable"
    ? 0
    : 1;

const percent = (rate: number) => `${Math.round(rate * 100)}%`;

const caseCount = (count: number) => `${count} ${count === 1 ? "case was" : "cases were"} not run.`;

export function formatReport(
  report: RunReport,
  summaries: readonly SetSummary[],
  selectedSets: readonly EvalSetName[],
): string {
  const setLines = selectedSets.map((set) => {
    const summary = summaries.find((candidate) => candidate.set === set);
    if (summary === undefined) {
      return `${set}: no cases`;
    }
    const errors = summary.errored === 0 ? "" : `, ${summary.errored} errored`;
    const missed =
      summary.mustPassMissed.length === 0
        ? ""
        : `, must-pass missed: ${summary.mustPassMissed.join(", ")}`;
    return `${set}: ${summary.passed} of ${summary.total} passed (${percent(summary.passRate)})${errors}, threshold ${summary.thresholdPercent}%${missed}, ${summary.met ? "met" : "NOT met"}`;
  });
  const listed = (status: "failed" | "error") =>
    report.cases
      .filter((evalCase) => evalCase.status === status)
      .map(({ id, failures }) => `${status} ${id}: ${failures.join(", ")}`);
  const notRun = report.cases.filter(({ status }) => status === "not_run").length;
  const stopLines =
    report.stopReason === "budget"
      ? [`Stopped at the token budget: ${caseCount(notRun)}`]
      : report.stopReason === "usage_unreadable"
        ? [`Stopped because assistant_usage could not be read: ${caseCount(notRun)}`]
        : [];
  const overBudgetLines = report.overBudget
    ? [`OVER BUDGET: ${report.tokensUsed} tokens used, the budget was ${report.budgetTokens}.`]
    : [];

  const { firstModelCall } = report;
  const promptLine = `First model call of the first case: ${
    firstModelCall === null
      ? "not read"
      : `input_tokens ${firstModelCall.inputTokens}, cache_creation_input_tokens ${firstModelCall.cacheCreationInputTokens}, cache_read_input_tokens ${firstModelCall.cacheReadInputTokens}`
  }`;

  return [
    ...setLines,
    ...listed("failed"),
    ...listed("error"),
    ...stopLines,
    ...overBudgetLines,
    `Tokens used: ${report.tokensUsed} of ${report.budgetTokens} (input, output and cache creation tokens, not the ${report.cacheReadTokens} cache read tokens)`,
    ...(report.judgeTokens === undefined || report.judgeTokens === 0
      ? []
      : [`Judge tokens: ${report.judgeTokens} (counted in the tokens used)`]),
    `Cost: USD ${(report.costUsdMicros / 1_000_000).toFixed(4)}`,
    promptLine,
  ].join("\n");
}
