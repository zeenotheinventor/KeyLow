import { parseArgs } from "node:util";

import { exitCodeOf, formatReport, summariseSets } from "./report.ts";
import { runEvals } from "./runEvals.ts";
import { EVAL_SET_NAMES, OPT_IN_SET_NAMES } from "./thresholds.ts";

import type { CaseEnvironment, EvalCase } from "./case.ts";
import type { TurnDriver } from "./driver.ts";
import type { RunReport } from "./runEvals.ts";
import type { EvalSetName } from "./thresholds.ts";
import type { EvalDatabase } from "./types.ts";

/** Q2 of ADR 0006: the tokens one run may spend. */
export const DEFAULT_BUDGET_TOKENS = 300_000;

const USAGE =
  "Usage: check:assistant [--set ask|describe|redTeam|compaction|writes|recipes|trainingAdvice|trainingEdits|trainingKnowledge|mealEstimate|featureRequest|kitchenProbe|palate|recipeSuggest|recipeAdjust|palateJudge|mealPlan|redTeamKitchen]... [--budget <tokens>] [--help]";

const HELP = [
  USAGE,
  "",
  "  --set <name>        Run only this set. Repeat it for more. The default is every set but trainingEdits, trainingKnowledge, mealEstimate, featureRequest, kitchenProbe, palate, recipeSuggest, recipeAdjust, palateJudge, mealPlan and redTeamKitchen, which are named to run.",
  `  --budget <tokens>   Stop before the case that would pass this many tokens. The default is ${DEFAULT_BUDGET_TOKENS}.`,
  "",
  "The budget counts input, output and cache creation tokens. Cache read tokens are reported but not counted.",
  "Needs ANTHROPIC_API_KEY. The assistant-evals workflow passes ANTHROPIC_EVAL_API_KEY as that variable.",
].join("\n");

/** What a run talks to: the driver, the database as the eval user, and a way to clean up. */
export type EvalSession = Readonly<{
  driver: TurnDriver;
  database: EvalDatabase;
  /** For a case that seeds a conversation or waits for a compaction. */
  environment?: CaseEnvironment;
  close: () => Promise<void>;
}>;

export type CliDependencies = Readonly<{
  cases: readonly EvalCase[];
  openSession: () => Promise<EvalSession>;
  /** The tokens the judge has used so far. They count in the budget and the report (`src/judge.ts`). */
  judgeTokens?: () => number;
}>;

export type CliOutput = Readonly<{ exitCode: number; stdout: string; stderr: string }>;

const failure = (message: string): CliOutput => ({ exitCode: 1, stdout: "", stderr: message });

const isEvalSetName = (value: string): value is EvalSetName =>
  EVAL_SET_NAMES.some((name) => name === value);

type Options = Readonly<{ sets: EvalSetName[]; budgetTokens: number; help: boolean }>;

/** The options, or the message that says what is wrong with them. */
function parseOptions(args: readonly string[]): Options | string {
  let values: {
    set?: string[] | undefined;
    budget?: string | undefined;
    help?: boolean | undefined;
  };
  try {
    values = parseArgs({
      // pnpm hands the lone double dash of `pnpm check:assistant -- --set ask` on to the script, so it is dropped here.
      args: args[0] === "--" ? args.slice(1) : [...args],
      options: {
        set: { type: "string", multiple: true },
        budget: { type: "string" },
        help: { type: "boolean" },
      },
      allowPositionals: false,
    }).values;
  } catch {
    return `Unknown or incomplete option. ${USAGE}`;
  }

  const requestedSets = values.set ?? [];
  const unknownSet = requestedSets.find((name) => !isEvalSetName(name));
  if (unknownSet !== undefined) {
    return `Unknown set "${unknownSet}". The sets are ${EVAL_SET_NAMES.join(", ")}.`;
  }

  const budgetTokens = values.budget === undefined ? DEFAULT_BUDGET_TOKENS : Number(values.budget);
  if (!Number.isInteger(budgetTokens) || budgetTokens <= 0) {
    return "--budget must be a whole number of tokens above 0.";
  }

  return { sets: requestedSets.filter(isEvalSetName), budgetTokens, help: values.help === true };
}

/**
 * Runs one `check:assistant` command and returns what it prints and its exit code, so a missing key or a
 * bad option is a message and never a stack trace. The key's value is never printed.
 *
 * Exit code 1 means a set is below its threshold, the run used more tokens than its budget, the spend could
 * not be read, or the run could not start. A budget stop that leaves every set at or above its threshold
 * exits 0, and that is correct: the cases it skipped count as misses, and the run still proved the thresholds.
 * A run with no cases is a failure, because a green exit must mean something was proved.
 */
export async function runCli(
  argv: readonly string[],
  environment: Readonly<Record<string, string | undefined>>,
  { cases, openSession, judgeTokens }: CliDependencies,
): Promise<CliOutput> {
  const options = parseOptions(argv);
  if (typeof options === "string") {
    return failure(options);
  }
  if (options.help) {
    return { exitCode: 0, stdout: HELP, stderr: "" };
  }

  if ((environment["ANTHROPIC_API_KEY"] ?? "").trim() === "") {
    return failure(
      "ANTHROPIC_API_KEY is not set. Start the run from the assistant-evals workflow, which passes ANTHROPIC_EVAL_API_KEY as ANTHROPIC_API_KEY, or export a key for a local run.",
    );
  }

  const selectedSets =
    options.sets.length === 0
      ? EVAL_SET_NAMES.filter((name) => !OPT_IN_SET_NAMES.includes(name))
      : options.sets;
  const selectedCases = cases.filter(({ set }) => selectedSets.includes(set));
  if (selectedCases.length === 0) {
    return failure(`No eval cases are registered for ${selectedSets.join(", ")}.`);
  }

  let session: EvalSession;
  try {
    session = await openSession();
  } catch (error) {
    return failure(
      `Could not start the eval session: ${error instanceof Error ? error.message : "unknown error"}`,
    );
  }

  let report: RunReport;
  let closeWarning = "";
  try {
    report = await runEvals({
      cases: selectedCases,
      driver: session.driver,
      database: session.database,
      ...(session.environment === undefined ? {} : { environment: session.environment }),
      budgetTokens: options.budgetTokens,
      ...(judgeTokens === undefined ? {} : { judgeTokens }),
    });
  } finally {
    // A failure to clean up must not hide the report, so it is a warning and the report goes out.
    closeWarning = await session.close().then(
      () => "",
      (error: unknown) =>
        `The eval session did not close cleanly: ${error instanceof Error ? error.message : "unknown error"}`,
    );
  }

  const summaries = summariseSets(report);
  return {
    exitCode: exitCodeOf(report, summaries),
    stdout: formatReport(report, summaries, selectedSets),
    stderr: closeWarning,
  };
}
