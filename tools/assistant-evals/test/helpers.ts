import type { SendMessageInput, TurnDriver } from "../src/driver.ts";
import type { EvalDatabase, RowQuery, ToolCall, TurnResult, TurnUsage } from "../src/types.ts";

export const noUsage: TurnUsage = {
  inputTokens: 0,
  outputTokens: 0,
  cacheReadInputTokens: 0,
  cacheCreationInputTokens: 0,
  costUsdMicros: 0,
};

let turnCounter = 0;

/** A hand-made turn result. Each call gets a new turn id, so two results never share usage. */
export function turnResult(overrides: Partial<TurnResult> = {}): TurnResult {
  turnCounter += 1;
  return {
    conversationId: "conversation-1",
    turnId: `turn-${turnCounter}`,
    status: "complete",
    answer: "",
    toolCalls: [],
    ...overrides,
  };
}

export function readTool(name: string, input: unknown = {}): ToolCall {
  return { name, input, readOnlyHint: true };
}

export function writeTool(name: string, input: unknown = {}): ToolCall {
  return { name, input, readOnlyHint: false };
}

const sumOf = (left: TurnUsage, right: Partial<TurnUsage>): TurnUsage => ({
  inputTokens: left.inputTokens + (right.inputTokens ?? 0),
  outputTokens: left.outputTokens + (right.outputTokens ?? 0),
  cacheReadInputTokens: left.cacheReadInputTokens + (right.cacheReadInputTokens ?? 0),
  cacheCreationInputTokens: left.cacheCreationInputTokens + (right.cacheCreationInputTokens ?? 0),
  costUsdMicros: left.costUsdMicros + (right.costUsdMicros ?? 0),
});

type FakeDatabaseOptions = {
  /** The row count to answer for a table, whatever the filters. */
  rowCounts?: Readonly<Record<string, number>>;
  /** The rows to answer for a table, whatever the filters. */
  rows?: Readonly<Record<string, readonly Readonly<Record<string, unknown>>[]>>;
  /** The usage to answer for a turn id. A turn that is not listed has none. */
  usageByTurnId?: Readonly<Record<string, Partial<TurnUsage>>>;
  /** The usage of the first model call of a turn. Falls back to the usage of the turn. */
  firstCallByTurnId?: Readonly<Record<string, Partial<TurnUsage>>>;
  /** The usage of the whole user. */
  userUsage?: Partial<TurnUsage>;
};

/** An `EvalDatabase` that answers from the lists it was given and records the row queries it was asked. */
export function fakeDatabase(options: FakeDatabaseOptions = {}): EvalDatabase & {
  queries: RowQuery[];
} {
  const queries: RowQuery[] = [];
  return {
    queries,
    countRows: (query) => {
      queries.push(query);
      return Promise.resolve(options.rowCounts?.[query.table] ?? 0);
    },
    readRows: (query) => {
      queries.push(query);
      return Promise.resolve(options.rows?.[query.table] ?? []);
    },
    usageOfTurn: (turnId) => Promise.resolve(sumOf(noUsage, options.usageByTurnId?.[turnId] ?? {})),
    usageOfUser: () => Promise.resolve(sumOf(noUsage, options.userUsage ?? {})),
    firstModelCallOfTurn: (turnId) => {
      const usage = options.firstCallByTurnId?.[turnId] ?? options.usageByTurnId?.[turnId];
      return Promise.resolve(usage === undefined ? null : sumOf(noUsage, usage));
    },
  };
}

export type ScriptedTurn = {
  result: TurnResult;
  /** What the turn costs. It is billed to the user when the turn is sent. */
  usage?: Partial<TurnUsage>;
  /** False models a usage row that carries no usable turn id: the user is billed and the turn shows nothing. */
  recorded?: boolean;
  /** The driver bills the usage and then fails. */
  throws?: Error;
  /** The driver bills the usage and then never answers. */
  hangs?: boolean;
  /** The driver bills the usage and answers after this many milliseconds. */
  delayMs?: number;
};

/** A turn that costs `tokens` input tokens. */
export function costing(tokens: number, overrides: Partial<TurnResult> = {}): ScriptedTurn {
  return { result: turnResult(overrides), usage: { inputTokens: tokens } };
}

/**
 * A driver and a database that agree with each other the way the real ones do: sending a turn bills the
 * user, and the database reads the bills back by turn and by user.
 */
export function scriptedStack(script: readonly ScriptedTurn[]): {
  driver: TurnDriver & { sent: SendMessageInput[] };
  database: EvalDatabase;
} {
  const sent: SendMessageInput[] = [];
  let userTotal = noUsage;
  const byTurnId = new Map<string, TurnUsage>();

  const driver = {
    sent,
    sendMessage: (input: SendMessageInput): Promise<TurnResult> => {
      const step = script[sent.length];
      sent.push(input);
      if (step === undefined) {
        return Promise.reject(new Error("The scripted stack has no turn left"));
      }
      const usage = sumOf(noUsage, step.usage ?? {});
      userTotal = sumOf(userTotal, usage);
      if (step.recorded !== false) {
        byTurnId.set(step.result.turnId, usage);
      }
      if (step.hangs === true) {
        return new Promise(() => undefined);
      }
      const answer = () =>
        step.throws === undefined ? Promise.resolve(step.result) : Promise.reject(step.throws);
      return step.delayMs === undefined
        ? answer()
        : new Promise((resolve) => setTimeout(resolve, step.delayMs)).then(answer);
    },
  };

  const database: EvalDatabase = {
    countRows: () => Promise.resolve(0),
    readRows: () => Promise.resolve([]),
    usageOfTurn: (turnId) => Promise.resolve(byTurnId.get(turnId) ?? noUsage),
    usageOfUser: () => Promise.resolve(userTotal),
    firstModelCallOfTurn: (turnId) => Promise.resolve(byTurnId.get(turnId) ?? null),
  };

  return { driver, database };
}
