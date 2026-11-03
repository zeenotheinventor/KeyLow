import type { CaseEnvironment, EvalCase } from "./case.ts";
import type { TurnDriver } from "./driver.ts";
import type { EvalSetName } from "./thresholds.ts";
import type { EvalDatabase, TurnResult, TurnUsage } from "./types.ts";

export type CaseReport = Readonly<{
  id: string;
  set: EvalSetName;
  /**
   * `failed` is a miss by the assistant. `error` is the harness or the infrastructure failing (a driver error, a
   * database error, a failed turn, a case that took too long) and says nothing about the assistant. Both are
   * misses for the exit code. `not_run` means the budget, or an unreadable spend, stopped the run before the case.
   */
  status: "passed" | "failed" | "error" | "not_run";
  failures: readonly string[];
  /** The tokens the budget counts, for this case. */
  tokens: number;
}>;

export type RunReport = Readonly<{
  cases: readonly CaseReport[];
  /** The tokens the budget counts: input, output and cache creation tokens of every `assistant_usage` row of the eval user. */
  tokensUsed: number;
  /** Cache read tokens, reported but not counted against the budget. */
  cacheReadTokens: number;
  costUsdMicros: number;
  budgetTokens: number;
  stopReason: "budget" | "usage_unreadable" | null;
  /** True when the run used more than the budget, which a turn that overshoots can do. */
  overBudget: boolean;
}>;

export const DEFAULT_CASE_TIMEOUT_MS = 120_000;

type RunInput = Readonly<{
  cases: readonly EvalCase[];
  driver: TurnDriver;
  database: EvalDatabase;
  /** What a case that seeds a conversation or waits for a compaction uses. Left out, such a case ends in error. */
  environment?: CaseEnvironment;
  budgetTokens: number;
  /** The wall-clock ceiling of one case. A hung stream fails the case, not the job. */
  caseTimeoutMs?: number;
}>;

/**
 * Cache reads are left out. They cost a tenth of an input token, and a working prompt cache makes them most
 * of a conversation's tokens, so counting them would use the budget up on the very thing the cache grader
 * wants to see, and a healthy cache would look like overspending.
 */
const countedTokensOf = (usage: TurnUsage): number =>
  usage.inputTokens + usage.outputTokens + usage.cacheCreationInputTokens;

const hasNoUsage = (usage: TurnUsage): boolean =>
  usage.inputTokens +
    usage.outputTokens +
    usage.cacheReadInputTokens +
    usage.cacheCreationInputTokens ===
  0;

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : "unknown error";

// Every way out of a case is a throw and one catch. These two carry a reason that is already phrased for the report.
class CaseStopped extends Error {}
class CaseError extends Error {}

type Outcome = Pick<CaseReport, "status" | "failures">;

function afterCeiling<Result>(
  work: Promise<Result>,
  ceilingMs: number,
  onCeiling: () => void,
): Promise<Result> {
  let timer: NodeJS.Timeout | undefined;
  const ceiling = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      onCeiling();
      reject(new CaseError(`the case took longer than ${ceilingMs} ms`));
    }, ceilingMs);
  });
  // The call in flight cannot be cancelled, so it may still finish in the background. The caller's `onCeiling`
  // is how the rest of the work knows to stop.
  return Promise.race([work, ceiling]).finally(() => {
    clearTimeout(timer);
  });
}

/**
 * Runs the cases in order through the driver, grades each, and watches the spend of the eval user.
 *
 * The spend is the sum of every `assistant_usage` row of the eval user, read after every turn, so a row with
 * the wrong turn id, a compaction call and a turn whose driver threw are all counted. The user is new for the
 * run, so the sum is the run's. A turn that reports no usage at all is a harness error, because a budget that
 * cannot see spend would let a run go on for ever. Before each case the runner expects it to cost as much as the
 * largest case so far, and when that would pass `budgetTokens` it stops: that case and the ones after it are not
 * run and never sent. The first case has no history, so it always runs. Inside a case, no further turn is sent
 * once the budget is reached.
 */
export async function runEvals(input: RunInput): Promise<RunReport> {
  const {
    driver,
    database,
    environment,
    budgetTokens,
    caseTimeoutMs = DEFAULT_CASE_TIMEOUT_MS,
  } = input;
  const reports: CaseReport[] = [];
  // What the eval user has used so far, as the last read of `assistant_usage` saw it. Null before the first read.
  const spend: { latest: TurnUsage | null } = { latest: null };
  let stopReason: RunReport["stopReason"] = null;
  let largestCaseTokens = 0;

  const countedSoFar = () => (spend.latest === null ? 0 : countedTokensOf(spend.latest));

  async function readSpend() {
    spend.latest = await database.usageOfUser();
  }

  async function playCase(evalCase: EvalCase, isAbandoned: () => boolean): Promise<Outcome> {
    const turns: TurnResult[] = [];
    const needsEnvironment = evalCase.setup !== undefined || evalCase.afterTurn !== undefined;
    if (needsEnvironment && environment === undefined) {
      throw new CaseError("the case needs a session with a case environment");
    }
    let conversationId: string | null =
      evalCase.setup === undefined || environment === undefined
        ? null
        : await evalCase.setup(environment);
    for (const [index, text] of evalCase.messages.entries()) {
      // A case that hit its ceiling is abandoned, and its loop must not go on sending messages to the model.
      if (isAbandoned()) {
        throw new CaseError("the case was abandoned after its ceiling");
      }
      if (countedSoFar() >= budgetTokens) {
        stopReason = "budget";
        throw new CaseStopped(`the budget was reached before turn ${index + 1}`);
      }
      const turn = await driver.sendMessage({ conversationId, text });
      turns.push(turn);
      conversationId = turn.conversationId;
      await readSpend();
      if (isAbandoned()) {
        throw new CaseError("the case was abandoned after its ceiling");
      }
      if (turn.status === "failed") {
        throw new CaseError("the turn failed");
      }
      if (hasNoUsage(await database.usageOfTurn(turn.turnId))) {
        throw new CaseError("no assistant_usage rows for the turn");
      }
      if (evalCase.afterTurn !== undefined && environment !== undefined) {
        await evalCase.afterTurn({ index, result: turn }, environment);
        // The wait is billed too: the compaction call it waited for is a row of the eval user.
        await readSpend();
      }
    }
    const outcomes = await Promise.all(evalCase.expect.map((grade) => grade({ turns, database })));
    const failures = outcomes.filter(({ passed }) => !passed).map(({ reason }) => reason);
    return { status: failures.length === 0 ? "passed" : "failed", failures };
  }

  async function runCase(evalCase: EvalCase): Promise<Outcome> {
    try {
      const abandoned = { value: false };
      return await afterCeiling(
        playCase(evalCase, () => abandoned.value),
        caseTimeoutMs,
        () => {
          abandoned.value = true;
        },
      );
    } catch (error) {
      if (error instanceof CaseStopped) {
        return { status: "not_run", failures: [error.message] };
      }
      const reason =
        error instanceof CaseError ? error.message : `the run failed: ${messageOf(error)}`;
      return { status: "error", failures: [reason] };
    }
  }

  for (const evalCase of input.cases) {
    const { id, set } = evalCase;
    if (stopReason !== null || countedSoFar() + largestCaseTokens > budgetTokens) {
      stopReason ??= "budget";
      reports.push({ id, set, status: "not_run", failures: [], tokens: 0 });
      continue;
    }

    const before = countedSoFar();
    const outcome = await runCase(evalCase);
    // The case may have billed tokens before it failed or timed out, so the spend is read again whatever happened.
    let failures = outcome.failures;
    let status = outcome.status;
    try {
      await readSpend();
    } catch {
      stopReason = "usage_unreadable";
      status = "error";
      failures = [...failures, "assistant_usage could not be read"];
    }
    const tokens = countedSoFar() - before;
    reports.push({ id, set, status, failures, tokens });
    largestCaseTokens = Math.max(largestCaseTokens, tokens);
  }

  return {
    cases: reports,
    tokensUsed: countedSoFar(),
    cacheReadTokens: spend.latest?.cacheReadInputTokens ?? 0,
    costUsdMicros: spend.latest?.costUsdMicros ?? 0,
    budgetTokens,
    stopReason,
    overBudget: countedSoFar() > budgetTokens,
  };
}
