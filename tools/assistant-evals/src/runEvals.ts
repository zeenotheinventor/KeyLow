import { describeTurnEndedAfterWrite, isConfirmAnswer } from "@keylow/core";

import type { CaseEnvironment, EvalCase } from "./case.ts";
import type { TurnDriver } from "./driver.ts";
import type { EvalSetName } from "./thresholds.ts";
import type { EvalDatabase, TurnResult, TurnUsage } from "./types.ts";

export type CaseReport = Readonly<{
  id: string;
  set: EvalSetName;
  /**
   * `failed` is a miss by the assistant. `error` is a case that could not be judged (a driver error, a database
   * error, a failed turn, a case that took too long) and says nothing certain about the assistant: a failed turn
   * may be the assistant (`confirm_unavailable`) or an outage, and its reason says where to look. Both are
   * misses for the exit code. `not_run` means the budget, or an unreadable spend, stopped the run before the case.
   */
  status: "passed" | "failed" | "error" | "not_run";
  failures: readonly string[];
  /** True for a case whose miss fails its set whatever the percentage (`EvalCase.mustPass`). */
  mustPass?: true;
  /** True when a grader marked critical failed, which fails the case's set whatever the percentage. */
  critical?: true;
  /** True when the case failed only on soft graders, so it is a miss of the percentage and no missed must-pass. */
  softOnly?: true;
  /** The tokens the budget counts, for this case. */
  tokens: number;
}>;

/** The part of a model call's usage that shows how much of the prompt was cached. Counts only, never text. */
export type PromptUsage = Pick<
  TurnUsage,
  "inputTokens" | "cacheCreationInputTokens" | "cacheReadInputTokens"
>;

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
  /**
   * The usage of the first model call of the first case, which writes the prompt cache (or reads it, when an
   * earlier run just wrote it), so it shows how large the cached prompt is. Null when that call was not read.
   */
  firstModelCall: PromptUsage | null;
}>;

export const DEFAULT_CASE_TIMEOUT_MS = 120_000;

// How long the prepare of a case may take. It is slow work shared by later cases, such as a history written one
// request at a time, so the ceiling is generous, but a request that hangs must not stall the run.
export const DEFAULT_PREPARE_TIMEOUT_MS = 600_000;

// How long a case that hit its ceiling is given to finish its cleanUp before the next case starts. The turn in
// flight cannot be cancelled, so it may never come back, and the run must not wait for ever.
export const DEFAULT_CLEAN_UP_GRACE_MS = 60_000;

type RunInput = Readonly<{
  cases: readonly EvalCase[];
  driver: TurnDriver;
  database: EvalDatabase;
  /** What a case that seeds a conversation or waits for a compaction uses. Left out, such a case ends in error. */
  environment?: CaseEnvironment;
  budgetTokens: number;
  /** The wall-clock ceiling of one case. A hung stream fails the case, not the job. */
  caseTimeoutMs?: number;
  /** How long a case that hit its ceiling may take to clean up before the next case starts. */
  cleanUpGraceMs?: number;
  /** The ceiling of a case's `prepare`. A case whose prepare took longer is reported as not prepared. */
  prepareTimeoutMs?: number;
}>;

/**
 * Cache reads are left out. They cost a tenth of an input token, and a working prompt cache makes them most
 * of a conversation's tokens, so counting them would use the budget up on the very thing the cache grader
 * wants to see, and a healthy cache would look like overspending.
 */
const countedTokensOf = (usage: TurnUsage): number =>
  usage.inputTokens + usage.outputTokens + usage.cacheCreationInputTokens;

const promptUsageOf = (usage: TurnUsage | null): PromptUsage | null =>
  usage === null
    ? null
    : {
        inputTokens: usage.inputTokens,
        cacheCreationInputTokens: usage.cacheCreationInputTokens,
        cacheReadInputTokens: usage.cacheReadInputTokens,
      };

const hasNoUsage = (usage: TurnUsage): boolean =>
  usage.inputTokens +
    usage.outputTokens +
    usage.cacheReadInputTokens +
    usage.cacheCreationInputTokens ===
  0;

/**
 * Whether the message is the press of a confirm button: the previous turn ended asking for a confirmation, and
 * the message is exactly the words of its confirm button, compared as the app and the executor compare them. The
 * turn loop runs such a turn in code and makes no model call (KEY-840), so it has no `assistant_usage` row on
 * purpose. Anything else, a typed answer included, is a model turn.
 */
const isConfirmPress = (previous: TurnResult | undefined, text: string): boolean =>
  previous?.status === "confirm" &&
  isConfirmAnswer(text, previous.confirmation?.confirmLabel ?? null);

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : "unknown error";

// Every way out of a case is a throw and one catch. These two carry a reason that is already phrased for the report.
class CaseStopped extends Error {}
class CaseError extends Error {}

type Outcome = Pick<CaseReport, "status" | "failures" | "critical" | "softOnly">;

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

// The tools that ask first. A turn that fails right after a call to one of them may be the model giving no
// question to put above the buttons, which the function ends as `confirm_unavailable`. It may also be an
// outage or a database error, so the reason only says it is possible.
const TOOLS_THAT_ASK_FIRST: ReadonlySet<string> = new Set([
  "delete_entry",
  "copy_day",
  "archive_recipe",
  "update_targets",
]);

/**
 * Why a failed turn is an error. The ending code is only in the function's log, so this names the notice the
 * turn sent and, after a tool that asks first, says `confirm_unavailable` is possible and where to look. The
 * status stays `error` and the report keeps its shape.
 */
function failedTurnReason(turn: TurnResult): string {
  const notice = turn.noticeCode === undefined ? "no notice" : `notice ${turn.noticeCode}`;
  const asked = [...turn.toolCalls].reverse().find(({ name }) => TOOLS_THAT_ASK_FIRST.has(name));
  return asked === undefined
    ? `the turn failed (${notice})`
    : `the turn failed (${notice}) after a call to ${asked.name}, a tool that asks first: may be confirm_unavailable (the model gave no question to put above the buttons), check the function log for the ending`;
}

// A turn that failed or was cut short after a write landed ends complete, with fixed words as its reply
// (KEY-926). Every grader passes on `complete`, so a case that hit a limit after its write would pass. It is an
// error instead, the same verdict a failed turn gets.
const endedEarlyAfterWrite = (turn: TurnResult): boolean =>
  [describeTurnEndedAfterWrite(1), describeTurnEndedAfterWrite(2)].some((words) =>
    turn.answer.trimEnd().endsWith(words),
  );

/**
 * Runs the cases in order through the driver, grades each, and watches the spend of the eval user.
 *
 * The spend is the sum of every `assistant_usage` row of the eval user, read after every turn, so a row with
 * the wrong turn id, a compaction call and a turn whose driver threw are all counted. The user is new for the
 * run, so the sum is the run's. A turn that reports no usage at all is a harness error, because a budget that
 * cannot see spend would let a run go on for ever. The one exception is the press of a confirm button, which
 * makes no model call. Before each case the runner expects it to cost as much as the
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
    cleanUpGraceMs = DEFAULT_CLEAN_UP_GRACE_MS,
    prepareTimeoutMs = DEFAULT_PREPARE_TIMEOUT_MS,
  } = input;
  // The prepares that hung. Cases that share one are not tried again, so a hung request is waited for once.
  const hungPrepares = new Set<() => Promise<void>>();
  const reports: CaseReport[] = [];
  // What the eval user has used so far, as the last read of `assistant_usage` saw it. Null before the first read.
  const spend: { latest: TurnUsage | null } = { latest: null };
  let stopReason: RunReport["stopReason"] = null;
  let largestCaseTokens = 0;
  let firstModelCall: PromptUsage | null = null;

  const countedSoFar = () => (spend.latest === null ? 0 : countedTokensOf(spend.latest));

  async function readSpend() {
    spend.latest = await database.usageOfUser();
  }

  async function playCase(evalCase: EvalCase, isAbandoned: () => boolean): Promise<Outcome> {
    const turns: TurnResult[] = [];
    const needsEnvironment =
      evalCase.setup !== undefined ||
      evalCase.afterTurn !== undefined ||
      evalCase.cleanUp !== undefined;
    if (needsEnvironment && environment === undefined) {
      throw new CaseError("the case needs a session with a case environment");
    }
    let outcome: Outcome | undefined;
    let thrown: unknown;
    try {
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
          throw new CaseError(failedTurnReason(turn));
        }
        if (endedEarlyAfterWrite(turn)) {
          throw new CaseError(
            "the turn ended early after a write landed, check the function log for the ending",
          );
        }
        // A press makes no model call, so it may have no usage row. Every other turn must have one, because a
        // turn that reports none would hide its spend from the budget.
        if (
          hasNoUsage(await database.usageOfTurn(turn.turnId)) &&
          !isConfirmPress(turns.at(-2), text)
        ) {
          throw new CaseError("no assistant_usage rows for the turn");
        }
        if (reports.length === 0 && index === 0) {
          // A line for the summary, so a read that fails leaves it empty and never changes the case's verdict.
          firstModelCall = await database
            .firstModelCallOfTurn(turn.turnId)
            .then(promptUsageOf, () => null);
        }
        if (evalCase.afterTurn !== undefined && environment !== undefined) {
          await evalCase.afterTurn({ index, result: turn }, environment);
          // The wait is billed too: the compaction call it waited for is a row of the eval user.
          await readSpend();
        }
      }
      const outcomes = await Promise.all(
        evalCase.expect.map((grade) => grade({ turns, database })),
      );
      const failures = outcomes.filter(({ passed }) => !passed).map(({ reason }) => reason);
      outcome = {
        status: failures.length === 0 ? "passed" : "failed",
        failures,
        ...(outcomes.some(({ passed, critical }) => !passed && critical === true)
          ? { critical: true as const }
          : {}),
        ...(failures.length > 0 && outcomes.every(({ passed, soft }) => passed || soft === true)
          ? { softOnly: true as const }
          : {}),
      };
    } catch (error) {
      thrown = error;
    }
    // After the graders have read the database, and also when the case failed half way, because a write that
    // landed must not stay in the rows the other sets read. A failure here is added to what the graders or the
    // turn already found, and never replaces it: an off-script write with no Undo must not hide the finding.
    let cleanUpFailure: string | undefined;
    if (evalCase.cleanUp !== undefined && environment !== undefined) {
      try {
        await evalCase.cleanUp(turns, environment);
      } catch (error) {
        cleanUpFailure = `cleanUp failed: ${messageOf(error)}`;
      }
    }
    if (thrown !== undefined) {
      if (cleanUpFailure !== undefined && thrown instanceof CaseError) {
        throw new CaseError(`${thrown.message}; ${cleanUpFailure}`);
      }
      throw thrown instanceof Error ? thrown : new Error(messageOf(thrown));
    }
    if (outcome === undefined) {
      throw new CaseError("the case ended without an outcome");
    }
    if (cleanUpFailure === undefined) {
      return outcome;
    }
    return {
      status: outcome.status === "passed" ? "error" : outcome.status,
      failures: [...outcome.failures, cleanUpFailure],
      ...(outcome.critical === true ? { critical: true as const } : {}),
    };
  }

  async function runCase(evalCase: EvalCase): Promise<Outcome> {
    try {
      // Slow shared work runs first and outside the ceiling, so a long history write is not a timed out case. It
      // has a ceiling of its own, so a request that hangs is a case that was not prepared.
      const { prepare } = evalCase;
      if (prepare !== undefined) {
        if (hungPrepares.has(prepare)) {
          throw new CaseError("the case could not be prepared: an earlier case's prepare hung");
        }
        let timer: NodeJS.Timeout | undefined;
        try {
          await Promise.race([
            prepare(),
            new Promise<never>((_resolve, reject) => {
              timer = setTimeout(() => {
                hungPrepares.add(prepare);
                reject(new Error(`took longer than ${prepareTimeoutMs} ms`));
              }, prepareTimeoutMs);
            }),
          ]);
        } catch (error) {
          throw new CaseError(`the case could not be prepared: ${messageOf(error)}`);
        } finally {
          clearTimeout(timer);
        }
      }
      const abandoned = { value: false };
      const work = playCase(evalCase, () => abandoned.value);
      try {
        return await afterCeiling(work, caseTimeoutMs, () => {
          abandoned.value = true;
        });
      } catch (error) {
        // An abandoned case still runs its cleanUp when its turn comes back, and that must not overlap the next
        // case, which could be waiting on the same rows. It is waited for, up to the grace.
        if (abandoned.value) {
          let timer: NodeJS.Timeout | undefined;
          await Promise.race([
            work.then(
              () => undefined,
              () => undefined,
            ),
            new Promise<void>((resolve) => {
              timer = setTimeout(resolve, cleanUpGraceMs);
            }),
          ]).finally(() => {
            clearTimeout(timer);
          });
        }
        throw error;
      }
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
      reports.push({
        id,
        set,
        status: "not_run",
        failures: [],
        tokens: 0,
        ...(evalCase.mustPass === true ? { mustPass: true as const } : {}),
      });
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
    reports.push({
      id,
      set,
      status,
      failures,
      tokens,
      ...(evalCase.mustPass === true ? { mustPass: true as const } : {}),
      ...(outcome.critical === true ? { critical: true as const } : {}),
      ...(outcome.softOnly === true ? { softOnly: true as const } : {}),
    });
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
    firstModelCall,
  };
}
