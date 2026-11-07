// The streaming turn loop behind POST /assistant/turn (ADR 0006). It replays the conversation, calls Haiku 5.5
// with the tools Ki-Lo's own MCP client lists, streams the text to the app, runs each tool call through that
// client, turns the executor's structured outcomes into cards, questions and citations, and stores
// everything through the turn store.
//
// Things to know when changing this file:
// - Every request after the first is built from the rows as the database returns them, through
//   `toApiMessages`, and never from the live response. jsonb re-sorts the keys of an object, so a live
//   object would send different bytes than the next turn replays, and the prompt cache would miss.
// - A tool call is made once. A thrown `McpClientError` ends the turn, so a write is never repeated.
// - Each tool result is stored the moment its call returns, as its own user row. `toApiMessages` joins the
//   rows of one role, so the model still reads one user message holding all the results of a response.
// - The press of a confirm button makes no model call: `runConfirmedCall` makes the stored call itself (KEY-840).
// - Nothing here logs or reports message text, a tool argument or a result.
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

import { toAnthropicTools } from "../_shared/assistant/adapters/anthropic.ts";
import { undoOutcomeSchema } from "../_shared/assistant/store.ts";
import { askUserTool } from "../_shared/assistant/tools/askUser.ts";
import { wrapUntrusted } from "../_shared/assistant/untrusted.ts";
import {
  assistantCardLinkSchema,
  assistantCardSchema,
  describeWorkoutInProgressRefusal,
  isConfirmAnswer,
  mergeAssistantCards,
  safeWordsToShow,
  withActionIds,
} from "../_shared/core.ts";
import { allowedToolsFor } from "./allowlist.ts";
import { COMPACTION_TIMEOUT_MILLISECONDS, planCompaction, promptTokensOf } from "./compact.ts";
import { confirmedCallOf } from "./confirmedCall.ts";
import { confirmWordsFor } from "./confirmWords.ts";
import {
  buildTurnRequest,
  contextBlock,
  MODEL,
  openToolUses,
  toApiMessagesWithNote,
  userContent,
} from "./prompt.ts";
import { endAsFailed, writeEvent } from "./sse.ts";
import { NO_MESSAGE_ID } from "./turnStore.ts";

import type { AnthropicTool } from "../_shared/assistant/adapters/anthropic.ts";
import type {
  ConnectToolServerOptions,
  ListedTool,
  ToolCallResult,
  ToolConnection,
} from "../_shared/assistant/mcpClient.ts";
import type { AssistantCard, AssistantStreamEvent } from "../_shared/core.ts";
import type { Json } from "../_shared/core/database.types.ts";
import type { ReportError } from "../_shared/report.ts";
import type { AllowlistTool } from "./allowlist.ts";
import type { RunTurn, TurnContext } from "./runTurn.ts";
import type { EventStream } from "./sse.ts";
import type { FinalTurnStatus, PreviousTurn, StoredMessage, TurnStore } from "./turnStore.ts";
import type { UsageToRecord } from "./usage.ts";

// A turn with ten writes needs eleven model calls (one for each write and the answer), and the reads before
// the writes take a few more. More than this is a loop, and each call is a few seconds of the Edge Function's
// wall-clock limit, so the turn ends failed.
export const MAX_MODEL_CALLS = 12;

// The MCP client's default is 60 s per attempt, and a connect, a list or a read call retries once, so a hung
// connect could take 120 s. 20 s is far more than most tools take (the `mcp` function measured a few
// milliseconds on loopback). The one exception is `import_recipe_from_url`, which fetches a page and makes two
// model calls. It keeps itself inside 18 s (fetch 5 s, parse 9 s, pick 4 s, a cutoff before it saves), so it
// needs no longer timeout here.
export const MCP_REQUEST_TIMEOUT_MILLISECONDS = 20_000;

// Supabase Edge Functions stop a worker after 150 s of wall-clock time on the free plan and 400 s on paid
// plans (https://supabase.com/docs/guides/functions/limits, checked 2026-11-03). The plan is not recorded in
// the repository, so the shorter limit is the one used. The SDK default of 10 minutes would outlast it. One
// retry is kept for a dropped connection or a 529, so a call that never answers costs 2 x 60 s at most,
// which the turn deadline below caps at 100 s. This bounds the wait for the response headers only. A stream that stalls after it started, and the turn
// as a whole, are bounded by `TURN_DEADLINE_MILLISECONDS` and `MODEL_STREAM_IDLE_MILLISECONDS` below.
export const MODEL_REQUEST_TIMEOUT_MILLISECONDS = 60_000;
const MODEL_MAX_RETRIES = 1;

// The Edge Function's wall clock on the free plan, the shorter of the two (150 s free, 400 s paid, from
// https://supabase.com/docs/guides/functions/limits, checked 2026-11-03).
const WALL_CLOCK_MILLISECONDS = 150_000;

// A step that takes no signal (`connect`, `listTools`, `callTool`) cannot be cut short, and a read retries
// once, so the longest one is two attempts of `MCP_REQUEST_TIMEOUT_MILLISECONDS`. A write never retries,
// so this is its worst case too.
const WORST_UNINTERRUPTIBLE_STEP_MILLISECONDS = 2 * MCP_REQUEST_TIMEOUT_MILLISECONDS;

// What is left for `conclude` (cards, `finishTurn`, `close`, the failed notice) and for the clock being a
// little off.
const CONCLUDE_MARGIN_MILLISECONDS = 10_000;

// A turn that passes this ends failed. 150 s - 40 s - 10 s = 100 s, so a tool call that starts just before
// the deadline can still run its worst case and the turn still ends inside the wall clock.
export const TURN_DEADLINE_MILLISECONDS =
  WALL_CLOCK_MILLISECONDS - WORST_UNINTERRUPTIBLE_STEP_MILLISECONDS - CONCLUDE_MARGIN_MILLISECONDS;

// The longest the model stream may be silent, from the response headers on, before the call is cut. The
// SDK drops the API's keep-alive pings before they reach the stream's listeners, so only a real stream
// event (a block start, a text chunk, a tool input fragment, a stop) resets the timer. The API can buffer a
// large tool input and send nothing but pings until it is complete, so the gap between two events can be
// many seconds. 45 s is far above any gap we expect, and two stalls in a row are still bounded by the
// 100 s deadline. It is a judgement, not a measurement: KEY-795 measures the real gaps.
export const MODEL_STREAM_IDLE_MILLISECONDS = 45_000;

export type TurnLimits = {
  deadlineMilliseconds: number;
  streamIdleMilliseconds: number;
  // The compaction call that follows a turn (KEY-706). It is outside the deadline above, so it has its own.
  compactionTimeoutMilliseconds?: number;
};

const DEFAULT_LIMITS: TurnLimits = {
  deadlineMilliseconds: TURN_DEADLINE_MILLISECONDS,
  streamIdleMilliseconds: MODEL_STREAM_IDLE_MILLISECONDS,
};

// The SDK parses a streamed tool input as it arrives, and a model that emits invalid JSON makes the stream
// fail with a plain `AnthropicError` whose cause is a `SyntaxError`, never an API error. That one failure
// is re-issued, a few times, and only while the app has been shown none of the call's text.
const MAX_UNPARSEABLE_INPUT_RETRIES = 2;

// The words under the field when the assistant asks a question (`assistant · clarify`), the same as core's.
const CLARIFY_FIELD_HINT = "Or say it your way";

const ASK_USER_TOOL = "ask_user";
const IMPORT_RECIPE_TOOL = "import_recipe_from_url";
const SEARCH_FOODS_TOOL = "search_foods";

// Made per turn, so a missing key ends that turn and never stops the function booting.
export function createModelClient(read: (name: string) => string | undefined): Anthropic | null {
  const apiKey = read("ANTHROPIC_API_KEY");
  if (apiKey === undefined || apiKey.trim() === "") {
    return null;
  }
  const baseURL = read("ANTHROPIC_BASE_URL");
  return new Anthropic({
    apiKey,
    ...(baseURL === undefined || baseURL === "" ? {} : { baseURL }),
    timeout: MODEL_REQUEST_TIMEOUT_MILLISECONDS,
    maxRetries: MODEL_MAX_RETRIES,
    // The SDK logs the raw data of a stream event it cannot parse, and that is message content.
    logLevel: "off",
  });
}

// The tools the `mcp` function lists are the same for every turn of a deployment (ADR 0006: `tools/list` is
// never filtered per turn). On the served local stack `initialize` plus `tools/list` took a median of 0.75 s
// per turn, 0.2 s of it the list (KEY-795), so the list is read once for the life of the function instance.
// A tool call that the executor answers `unknown_tool` drops it, so the next turn reads the list again
// (KEY-675's rule).
export type ToolListCache = {
  read(): readonly ListedTool[] | null;
  write(tools: readonly ListedTool[]): void;
  drop(): void;
};

export function createToolListCache(): ToolListCache {
  let cached: readonly ListedTool[] | null = null;
  return {
    read: () => cached,
    write(tools) {
      cached = tools;
    },
    drop() {
      cached = null;
    },
  };
}

export type TurnDependencies = {
  turns: TurnStore;
  toolListCache: ToolListCache;
  recordUsage(call: UsageToRecord): Promise<void>;
  // Keeps the runtime alive for work that outlives the response, which is the compaction. The task catches
  // its own errors.
  runInBackground(task: Promise<unknown>): void;
  connect(options: ConnectToolServerOptions): Promise<ToolConnection>;
  createModelClient(): Anthropic | null;
  // The tools the allowlist chooses from: the registry's, by name and read-only hint.
  availableTools: readonly AllowlistTool[];
  functionsBaseUrl(): string | undefined;
  report: ReportError;
  now(): Date;
};

// How a turn ended. `code` is for the log line only.
type Ending = { status: FinalTurnStatus; code: string };

const ending = (status: FinalTurnStatus, code: string = status): Ending => ({ status, code });
const failedEnding = (code: string): Ending => ending("failed", code);

// The two ways a turn can run too long. Each is the `code` of its failed ending.
type LimitCode = "turn_deadline" | "stream_idle";

type Run = {
  context: TurnContext;
  // `performance.now()` when the turn began.
  startedAt: number;
  stream: EventStream;
  // Aborts when the app closes the sheet or its request ends.
  signal: AbortSignal;
  limits: TurnLimits;
  // Aborts when the deadline passes or the model stream goes quiet. Apart from `signal`, so the two stay
  // apart: the reader going away is a stop, a limit is a failure.
  limitSignal: AbortController;
  limitCode: LimitCode | null;
  dependencies: TurnDependencies;
  counts: { modelCalls: number; toolCalls: number };
  // Writes that landed this turn: the answers that hold an action (a write that changed nothing holds none).
  landedWrites: number;
  // The code of the last tool error the loop read, so a press that wrote nothing can tell a refusal from a fault.
  lastErrorCode: string | null;
  // Whether a write of this turn was refused for a workout in progress, so the turn ends with Ask again. Set
  // by the first such refusal, which is also the only one that stores it, so a reopened turn draws one chip.
  askAgain: boolean;
  // The prompt of the last model call that answered, which is what the next request's size will start from.
  lastPromptTokens: number | null;
  unparseableInputRetries: number;
  // Consecutive cards of one kind with nothing said between them, merged when they are written.
  pendingCards: AssistantCard[];
  citations: (string | null)[];
  estimates: (string | null)[];
};

type Session = {
  client: Anthropic;
  connection: ToolConnection;
  allowedTools: ReadonlySet<string>;
  tools: AnthropicTool[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

// The SDK's objects as plain JSON, for the rows. Nothing is added or reordered.
const toJson = (value: unknown): Json => JSON.parse(JSON.stringify(value));

function hitLimit(run: Run, code: LimitCode): void {
  // The first limit is the reason. The abort that follows can only be the same turn ending.
  run.limitCode ??= code;
  run.limitSignal.abort();
}

// Why the step in flight, or the next one, must not go on: the reader went away (a stop, which wins over a
// limit that fired as well) or a limit passed (a failure, reported with a code and no content). Null when
// the turn may go on.
function interruption(run: Run): Ending | null {
  if (run.signal.aborted) {
    return ending("stopped");
  }
  if (run.limitCode === null) {
    return null;
  }
  run.dependencies.report("assistant", "internal_error", new Error(run.limitCode));
  return failedEnding(run.limitCode);
}

function emit(run: Run, event: AssistantStreamEvent): void {
  writeEvent(run.stream, event, run.dependencies.report);
}

function flushCards(run: Run): void {
  const [first, ...others] = run.pendingCards;
  if (first !== undefined) {
    emit(run, { type: "card", card: mergeAssistantCards([first, ...others]) });
  }
  run.pendingCards = [];
}

function addCard(run: Run, card: AssistantCard): void {
  if (run.pendingCards[0] !== undefined && run.pendingCards[0].kind !== card.kind) {
    flushCards(run);
  }
  run.pendingCards.push(card);
}

// The distinct non-empty values in call order, as `threadFromMessages` joins them on reopen.
function distinctLine(values: readonly (string | null)[]): string | null {
  const kept = [
    ...new Set(values.flatMap((value) => (value === null || value === "" ? [] : [value]))),
  ];
  return kept.length === 0 ? null : kept.join(" · ");
}

const nonBlank = (text: string): boolean => text.trim() !== "";

// What a call needs to run: the model's `tool_use` block, or the one the loop makes after a confirm button.
type CalledTool = Pick<Anthropic.ToolUseBlock, "id" | "name" | "input">;

const isToolUse = (block: Anthropic.ContentBlock): block is Anthropic.ToolUseBlock =>
  block.type === "tool_use";

// The text of a response, as `threadFromMessages` reads it: the blocks with something in them, joined.
const textOfResponse = (content: readonly Anthropic.ContentBlock[]): string =>
  content
    .flatMap((block) => (block.type === "text" && nonBlank(block.text) ? [block.text] : []))
    .join("\n\n");

// What is stored of a response: the blocks as received, except a blank text block (a 400 on replay). A
// response cut off by `max_tokens` or a refusal can end a call mid-input, so its calls are not stored. A
// message with no text and no call left in it is not stored at all, as the API refuses an empty one.
function contentToStore(message: Anthropic.Message): Json[] {
  const incomplete = message.stop_reason === "max_tokens" || message.stop_reason === "refusal";
  const kept = message.content.filter(
    (block) =>
      !(block.type === "text" && !nonBlank(block.text)) &&
      !(incomplete && block.type === "tool_use"),
  );
  return kept.some((block) => block.type === "text" || block.type === "tool_use")
    ? kept.map(toJson)
    : [];
}

const toolResultBlock = (
  toolUseId: string,
  content: string,
  isError: boolean,
): Anthropic.ToolResultBlockParam => ({
  type: "tool_result",
  tool_use_id: toolUseId,
  ...(content === "" ? {} : { content }),
  ...(isError ? { is_error: true as const } : {}),
});

async function storeToolResult(
  run: Run,
  block: Anthropic.ToolResultBlockParam,
  display: Json | null,
): Promise<void> {
  const { userId, conversationId, turnId } = run.context;
  await run.dependencies.turns.appendMessages(userId, conversationId, turnId, [
    { role: "user", content: [toJson(block)], display },
  ]);
}

async function storeAssistantContent(run: Run, content: Json[]): Promise<void> {
  if (content.length > 0) {
    const { userId, conversationId, turnId } = run.context;
    await run.dependencies.turns.appendMessages(userId, conversationId, turnId, [
      { role: "assistant", content },
    ]);
  }
}

async function recordCall(
  run: Run,
  startedAt: number,
  message: Anthropic.Message | null,
): Promise<void> {
  await run.dependencies.recordUsage({
    userId: run.context.userId,
    turnId: run.context.turnId,
    // The model that was asked for. A response can name a dated or aliased id that has no price.
    model: MODEL,
    inputTokens: message?.usage.input_tokens ?? 0,
    outputTokens: message?.usage.output_tokens ?? 0,
    cacheReadInputTokens: message?.usage.cache_read_input_tokens ?? 0,
    cacheCreationInputTokens: message?.usage.cache_creation_input_tokens ?? 0,
    latencyMilliseconds: Math.round(performance.now() - startedAt),
    stopReason: message?.stop_reason ?? null,
  });
}

// The SDK's failure to parse a streamed tool input: an `AnthropicError` caused by a `SyntaxError`. An API
// error, a dropped connection and a stream that ended early are not.
const isToolInputParseError = (caught: unknown): boolean =>
  caught instanceof Anthropic.AnthropicError &&
  !(caught instanceof Anthropic.APIError) &&
  caught.cause instanceof SyntaxError;

type ModelOutcome =
  { kind: "message"; message: Anthropic.Message } | { kind: "interrupted" } | { kind: "retry" };

// One streamed model call. The text goes to the app as it arrives. The call is cut short by the reader
// going away, by the turn's deadline, and by the stream going quiet for `streamIdleMilliseconds`.
async function callModel(
  run: Run,
  session: Session,
  request: Anthropic.MessageStreamParams,
): Promise<ModelOutcome> {
  const startedAt = performance.now();
  run.counts.modelCalls += 1;
  const modelStream = session.client.messages.stream(request, {
    signal: AbortSignal.any([run.signal, run.limitSignal.signal]),
  });
  // Armed when the response headers arrive (`connect`, before the first stream event) and pushed back by
  // every stream event after it (`streamEvent`: message_start, each block start, delta and stop, the
  // message_delta and message_stop). A ping never gets here: the SDK skips it while it reads the stream.
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  const watchForSilence = () => {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => hitLimit(run, "stream_idle"), run.limits.streamIdleMilliseconds);
  };
  modelStream.on("connect", watchForSilence);
  modelStream.on("streamEvent", watchForSilence);
  let textStarted = false;
  let textEmitted = false;
  modelStream.on("text", (delta, snapshot) => {
    textEmitted = true;
    if (!textStarted && nonBlank(snapshot)) {
      // The cards so far are written before the words that follow them.
      textStarted = true;
      flushCards(run);
    }
    emit(run, { type: "text", delta });
  });
  let message: Anthropic.Message;
  try {
    message = await modelStream.finalMessage();
  } catch (caught) {
    clearTimeout(idleTimer);
    // The call failed before any usage arrived, and it is still one call.
    await recordCall(run, startedAt, null).catch((recordFailure: unknown) =>
      run.dependencies.report("assistant", "internal_error", recordFailure),
    );
    if (
      run.signal.aborted ||
      run.limitCode !== null ||
      caught instanceof Anthropic.APIUserAbortError
    ) {
      const partial = (modelStream.currentMessage?.content ?? []).flatMap((block) =>
        block.type === "text" && nonBlank(block.text) ? [{ type: "text", text: block.text }] : [],
      );
      await storeAssistantContent(run, partial);
      return { kind: "interrupted" };
    }
    if (
      !isToolInputParseError(caught) ||
      textEmitted ||
      run.unparseableInputRetries >= MAX_UNPARSEABLE_INPUT_RETRIES
    ) {
      throw caught;
    }
    run.unparseableInputRetries += 1;
    return { kind: "retry" };
  }
  clearTimeout(idleTimer);
  run.unparseableInputRetries = 0;
  run.lastPromptTokens = promptTokensOf(message.usage);
  // A good response is kept whatever happens to its usage row.
  await recordCall(run, startedAt, message).catch((recordFailure: unknown) =>
    run.dependencies.report("assistant", "internal_error", recordFailure),
  );
  return { kind: "message", message };
}

const structuredSchema = z.looseObject({
  card: z.unknown().optional(),
  link: z.unknown().optional(),
  citation: z.string().min(1).nullish(),
  estimate: z.string().min(1).nullish(),
  undo: z.unknown().optional(),
});
const cardDraftSchema = assistantCardSchema.omit({ actionIds: true });

// What the app draws for one result, keyed by the call's id, or null when there is nothing to draw.
type Display = { [key: string]: Json };

async function finishCall(
  run: Run,
  toolUse: CalledTool,
  result: ToolCallResult,
  responseText: string,
): Promise<Ending | null> {
  const block = toolResultBlock(toolUse.id, result.text, result.isError);
  const { outcome } = result;
  if (outcome.status === "needs_confirmation") {
    const words = confirmWordsFor(toolUse.name, toolUse.input);
    // The model's own words when it wrote some, and the tool's otherwise, so a model that wrote no
    // question does not fail the turn. The tool's words are the board's, built from the person's own rows.
    // When the confirmation is asked again, the model's text is never the question, because a model that
    // misread "Keep them" may have written "Deleting those now." That text has already streamed, so it
    // stays above the question.
    const modelWords = outcome.asksAgain === true ? "" : responseText.trim();
    const question = modelWords === "" ? (outcome.question ?? "") : modelWords;
    if (words === null || question === "") {
      // A bug the evals catch: neither the model nor the tool worded the question, or the tool has no
      // buttons yet. The tool's words are missing only while the `mcp` function is the old one (a deploy).
      await storeToolResult(run, block, null);
      run.dependencies.report(
        "assistant",
        "internal_error",
        new Error("a confirmation cannot be asked"),
      );
      return failedEnding("confirm_unavailable");
    }
    // The model worded the question before the tool answered, so a line the tool wrote (the figures the
    // model could not know) is added after it, as its own paragraph. The guard above tests the question, so
    // a note alone never makes a confirmation.
    const confirm = {
      confirmationId: outcome.confirmationId,
      question: outcome.note === undefined ? question : `${question}\n\n${outcome.note}`,
      ...words,
    };
    await storeToolResult(run, block, { [toolUse.id]: { confirm } });
    flushCards(run);
    emit(run, { type: "confirm", ...confirm });
    return ending("confirm");
  }
  if (outcome.status === "error") {
    run.lastErrorCode = outcome.code;
    // A write refused for a workout in progress is answered by the model's words and then Ask again
    // (`assistant · workout-in-progress`), with no notice and no failed turn. The chip is stored on the first
    // such result only, because the app draws one for each entry that holds it.
    const storesAskAgain = outcome.code === "workout_in_progress" && !run.askAgain;
    run.askAgain ||= outcome.code === "workout_in_progress";
    await storeToolResult(run, block, storesAskAgain ? { [toolUse.id]: { askAgain: true } } : null);
    return null;
  }
  if (outcome.actionId !== null) {
    run.landedWrites += 1;
  }
  const structured = structuredSchema.safeParse(outcome.structured);
  if (!structured.success && outcome.structured !== null) {
    // A tool answered something the loop cannot read, which is a bug in the tool.
    run.dependencies.report(
      "assistant",
      "internal_error",
      new Error("a structured outcome cannot be read"),
    );
  }
  const entry: Display = {};
  let card: AssistantCard | null = null;
  if (structured.success) {
    const { citation = null, estimate = null } = structured.data;
    run.citations.push(citation);
    run.estimates.push(estimate);
    if (citation !== null) {
      entry["citation"] = citation;
    }
    if (estimate !== null) {
      entry["estimate"] = estimate;
    }
    if (structured.data.card !== undefined) {
      const draft = cardDraftSchema.safeParse(structured.data.card);
      if (draft.success && outcome.actionId !== null) {
        card = withActionIds(draft.data, [outcome.actionId]);
        entry["card"] = toJson(card);
      } else {
        // The write landed and the app cannot draw it, which is a bug in the tool.
        run.dependencies.report("assistant", "internal_error", new Error("a card cannot be drawn"));
      }
    }
    // A link on its own, under the words of an answer that changed nothing (a day that cannot be removed here).
    if (structured.data.link !== undefined) {
      const link = assistantCardLinkSchema.safeParse(structured.data.link);
      if (link.success) {
        entry["link"] = toJson(link.data);
        emit(run, { type: "link", link: link.data });
      } else {
        // Fixed words only. A parse failure's own message is not reported, because it can quote the value.
        run.dependencies.report("assistant", "internal_error", new Error("a link cannot be drawn"));
      }
    }
    // After the card, in the same row. The previous value is the person's own data, so it is kept here beside
    // the card for Undo and goes nowhere else. A write that landed nothing has no action to undo.
    if (structured.data.undo !== undefined && outcome.actionId !== null) {
      const undo = undoOutcomeSchema.safeParse(structured.data.undo);
      if (undo.success) {
        entry["undo"] = toJson({ actionId: outcome.actionId, ...undo.data });
      } else {
        // Fixed words only. A parse failure's own message is not reported, because it can quote the value.
        run.dependencies.report(
          "assistant",
          "internal_error",
          new Error("an undo cannot be stored"),
        );
      }
    }
  }
  await storeToolResult(
    run,
    block,
    Object.keys(entry).length === 0 ? null : { [toolUse.id]: entry },
  );
  if (card !== null) {
    addCard(run, card);
  }
  return null;
}

const urlInputSchema = z.object({ url: z.string() });

function hostOf(input: Record<string, unknown>): string | null {
  const parsed = urlInputSchema.safeParse(input);
  if (!parsed.success) {
    return null;
  }
  try {
    // A link typed as the board shows it ("example.com/lemon-traybake") has no scheme.
    const address = /^[a-z][a-z0-9+.-]*:\/\//i.test(parsed.data.url)
      ? parsed.data.url
      : `https://${parsed.data.url}`;
    return new URL(address).hostname || null;
  } catch {
    return null;
  }
}

// One call of a response. Answers the ending when this call ends the turn, or null to go on. `isConfirmed` is
// true only for the call a button press makes, so the working line says "Removing" and not "Looking at".
async function runToolUse(
  run: Run,
  session: Session,
  toolUse: CalledTool,
  responseText: string,
  isConfirmed = false,
): Promise<Ending | null> {
  const { id, name, input } = toolUse;
  const interrupted = interruption(run);
  if (interrupted !== null) {
    return interrupted;
  }
  if (name === ASK_USER_TOOL) {
    const question = askUserTool.input.safeParse(input);
    if (!question.success) {
      await storeToolResult(
        run,
        toolResultBlock(id, wrapUntrusted(name, { error: "invalid_input" }), true),
        null,
      );
      return null;
    }
    flushCards(run);
    emit(run, {
      type: "clarify",
      question: question.data.question,
      quickReplies: question.data.quick_replies,
      fieldHint: CLARIFY_FIELD_HINT,
    });
    return ending("clarify");
  }
  if (!session.allowedTools.has(name)) {
    await storeToolResult(
      run,
      toolResultBlock(id, wrapUntrusted(name, { error: "tool_not_allowed" }), true),
      null,
    );
    return null;
  }
  if (!isRecord(input)) {
    // Neither the executor nor the model sees the input twice: it is handed back as it was received.
    await storeToolResult(
      run,
      toolResultBlock(id, JSON.stringify({ INVALID_JSON: JSON.stringify(input) }), true),
      null,
    );
    return null;
  }
  // Before the call, because a hint that came back with the result would arrive after the fetch. Only the
  // tool's name and the cleaned words of a search go out: the stream is not stored and the model never reads it.
  if (name === IMPORT_RECIPE_TOOL) {
    const host = hostOf(input);
    if (host !== null) {
      emit(run, { type: "status", code: "reading_recipe", host });
    }
  } else {
    emit(run, {
      type: "status",
      code: "tool",
      tool: name,
      food: name === SEARCH_FOODS_TOOL ? safeWordsToShow(input["q"]) : null,
      isConfirmed,
    });
  }
  run.counts.toolCalls += 1;
  // Once. A throw is a `McpClientError`, the turn ends, and the call is not made again.
  const result = await session.connection.callTool(name, input);
  if (result.outcome.status === "error" && result.outcome.code === "unknown_tool") {
    // The deployment moved on from the list this instance holds.
    run.dependencies.toolListCache.drop();
  }
  return await finishCall(run, toolUse, result, responseText);
}

// The model calls of the turn, until one of them ends it.
async function runModelCalls(run: Run, session: Session): Promise<Ending> {
  const { userId, conversationId } = run.context;
  const { turns } = run.dependencies;
  while (run.counts.modelCalls < MAX_MODEL_CALLS) {
    const interrupted = interruption(run);
    if (interrupted !== null) {
      return interrupted;
    }
    // After a tool the app cannot tell the model has started again, and the first call is covered by the
    // app's own "Thinking" from the press. A retry draws the same words again.
    if (run.counts.modelCalls > 0) {
      emit(run, { type: "status", code: "thinking" });
    }
    const { messages, compaction } = await turns.readConversation(userId, conversationId, {
      excludeMessageId: NO_MESSAGE_ID,
    });
    const request = buildTurnRequest({
      tools: session.tools,
      messages: toApiMessagesWithNote(messages, compaction, run.context.turnId),
    });
    const outcome = await callModel(run, session, request);
    if (outcome.kind === "interrupted") {
      return interruption(run) ?? ending("stopped");
    }
    if (outcome.kind === "retry") {
      continue;
    }
    const { message } = outcome;
    await storeAssistantContent(run, contentToStore(message));
    const toolUses = message.content.filter(isToolUse);
    switch (message.stop_reason) {
      case "tool_use":
        break;
      case "refusal":
        return ending("refused");
      case "max_tokens":
        return toolUses.length > 0 ? failedEnding("max_tokens") : ending("complete");
      case "end_turn":
      case "stop_sequence":
        return ending("complete");
      default:
        run.dependencies.report("assistant", "internal_error", new Error("unexpected stop reason"));
        return failedEnding("stop_reason");
    }
    const responseText = textOfResponse(message.content);
    for (const toolUse of toolUses) {
      const finished = await runToolUse(run, session, toolUse, responseText);
      if (finished !== null) {
        return finished;
      }
    }
    if (toolUses.length === 0) {
      return ending("complete");
    }
  }
  return failedEnding("model_call_limit");
}

// The executor's refusals that a person can cause on a press, and that the notice already answers. A workout in
// progress is answered in words of its own, before this is read.
const PRESS_REFUSALS: ReadonlySet<string> = new Set([
  "confirmation_invalid",
  "write_limit_reached",
]);

// The press of a confirm button (KEY-840). The person has decided, so the loop makes the stored call itself and
// no model is asked: a model that answered in prose would leave a press that does nothing, under words that
// may say it is done. The executor stays the guard, because `runToolUse` sends the same call a model's would,
// and `runWrite` checks the tool, the hash, the id, the person's stored words and the slot, and spends the
// confirmation once. The card is the answer. Anything else ends the turn with the failed-turn notice, so a
// press never ends in a claim that something happened. No model call is made, so `lastPromptTokens` stays
// null and no compaction is planned. Nothing here logs or reports the input.
async function runConfirmedCall(
  run: Run,
  session: Session,
  history: readonly StoredMessage[],
  previousTurn: PreviousTurn,
): Promise<Ending> {
  const call = confirmedCallOf(history, previousTurn);
  if (call === null) {
    run.dependencies.report(
      "assistant",
      "internal_error",
      new Error("a confirmed call cannot be found"),
    );
    return failedEnding("confirm_input_missing");
  }
  // Stored as an assistant row before it runs, so the history reads as a call the model made.
  await storeAssistantContent(run, [toJson(call)]);
  const finished = await runToolUse(run, session, call, "", true);
  if (finished !== null) {
    return finished;
  }
  if (run.lastErrorCode === "workout_in_progress") {
    // A workout started after the question was asked. No model answers a press, so the words are core's, and the
    // turn ends complete with Ask again, as a refusal that a model words does. Nothing was written or spent.
    const words = describeWorkoutInProgressRefusal();
    await storeAssistantContent(run, [{ type: "text", text: words }]);
    emit(run, { type: "text", delta: words });
    return ending("complete", "confirm_refused_workout");
  }
  if (run.pendingCards.length > 0) {
    return ending("complete");
  }
  if (run.landedWrites > 0) {
    // The write landed and the app cannot draw its card (a tool or a deploy that disagrees on the card). The
    // failed-turn notice says nothing was changed, which would be untrue, and there are no words of the loop's
    // own to put in its place. The turn ends complete with no card, and the report says what happened.
    run.dependencies.report(
      "assistant",
      "internal_error",
      new Error("a confirmed write landed without a card"),
    );
    return ending("complete", "confirm_written_no_card");
  }
  // An error, `not_found` and a write that changed nothing all end here. Only what is unexpected is reported: a
  // call that never ran, or an error that is not a refusal the person can cause. `not_found` and a state already
  // in place are answers and not errors, and a spent confirmation, the write limit or a workout in progress is a refusal.
  const refused = run.lastErrorCode !== null && PRESS_REFUSALS.has(run.lastErrorCode);
  const benign = run.counts.toolCalls > 0 && (run.lastErrorCode === null || refused);
  if (!benign) {
    run.dependencies.report(
      "assistant",
      "internal_error",
      new Error("a confirmed call wrote nothing"),
    );
  }
  return failedEnding("confirm_nothing_written");
}

function bearerToken(request: Request): string | null {
  const header = request.headers.get("Authorization");
  return header === null ? null : header.replace(/^Bearer\s+/i, "");
}

// Everything between the turn event and the ending: set up the turn, connect, run the model calls and
// close the connection.
async function takeTurn(run: Run): Promise<Ending> {
  const { context, dependencies } = run;
  const { turns } = dependencies;
  // First what needs no connection and no key, ending in the rewrite of the user message. A turn that fails
  // after that leaves a message the next turn can join, and a turn that fails before it leaves the raw text,
  // which `toApiMessages` puts behind the open results.
  const timeZone = await turns.readTimeZone(context.userId);
  const { messages: history, previousTurn } = await turns.readConversation(
    context.userId,
    context.conversationId,
    { excludeMessageId: context.userMessageId },
  );
  const content = userContent({
    openToolUses: openToolUses(history),
    context: contextBlock({
      now: dependencies.now().toISOString(),
      timeZone,
      localDate: context.localDate,
      localTime: context.localTime,
    }),
    text: context.text,
  });
  // Before the first model call, or the new message would sit after a call with no result.
  await turns.setUserMessageContent(context.userId, context.userMessageId, toJson(content));

  const client = dependencies.createModelClient();
  const functionsBaseUrl = dependencies.functionsBaseUrl();
  const accessToken = bearerToken(context.request);
  if (client === null || functionsBaseUrl === undefined || accessToken === null) {
    dependencies.report(
      "assistant",
      "internal_error",
      new Error("the assistant is not configured"),
    );
    return failedEnding("not_configured");
  }
  const pressedConfirm = isConfirmAnswer(context.text, previousTurn?.pendingConfirmLabel ?? null);
  const allowedTools = allowedToolsFor({
    text: context.text,
    // A confirmation adds its own tool only when the person's message is the button's words, so a
    // read-looking message after one no longer has the write at all.
    pendingConfirmationTool: pressedConfirm ? (previousTurn?.pendingTool ?? null) : null,
    tools: dependencies.availableTools,
  });
  const cachedTools = dependencies.toolListCache.read();
  const connection = await dependencies.connect({
    functionsBaseUrl,
    turnId: context.turnId,
    accessToken,
    allowedTools,
    localDate: context.localDate,
    localTime: context.localTime,
    turnHasAction: (turnId) => turns.turnHasAction(turnId),
    requestTimeoutMilliseconds: MCP_REQUEST_TIMEOUT_MILLISECONDS,
    ...(cachedTools === null ? {} : { knownTools: cachedTools }),
  });
  try {
    // Before any call, so a tool the list did not name is treated as a write.
    let listedTools = cachedTools;
    if (listedTools === null) {
      listedTools = await connection.listTools();
      // An empty list is never kept: it would leave every later turn on this instance with no tools.
      if (listedTools.length > 0) {
        dependencies.toolListCache.write(listedTools);
      }
    }
    const session: Session = {
      client,
      connection,
      allowedTools: new Set(allowedTools),
      tools: toAnthropicTools(listedTools),
    };
    // The button's words, on a turn that ended asking for that confirmation, are the person's decision.
    // Every other message, the cancel button and typed words included, is a model turn.
    if (pressedConfirm && previousTurn?.status === "confirm") {
      return await runConfirmedCall(run, session, history, previousTurn);
    }
    return await runModelCalls(run, session);
  } finally {
    await connection.close();
  }
}

// The compaction of a turn that ended complete, ready to run, or null when its prompt is not over the threshold
// or there is nothing to do.
async function planTurnCompaction(run: Run): Promise<(() => Promise<void>) | null> {
  const { context, dependencies, limits } = run;
  if (run.lastPromptTokens === null) {
    return null;
  }
  return await planCompaction(dependencies, {
    userId: context.userId,
    conversationId: context.conversationId,
    turnId: context.turnId,
    promptTokens: run.lastPromptTokens,
    millisecondsLeft: WALL_CLOCK_MILLISECONDS - (performance.now() - run.startedAt),
    timeoutMilliseconds: limits.compactionTimeoutMilliseconds ?? COMPACTION_TIMEOUT_MILLISECONDS,
  });
}

// The cards, the answer meta, the status and the closing events. The status is final before `done` is
// written, so the app that reads the thread on `done` finds it. A `finishTurn` that throws is reported and
// does not change how the turn ended.
async function conclude(run: Run, reached: Ending): Promise<Ending> {
  const { stream, context, dependencies } = run;
  // An event that broke the contract has already ended the stream as failed.
  const final =
    stream.done && reached.status !== "stopped" ? failedEnding("invalid_event") : reached;
  if (final.status !== "stopped") {
    flushCards(run);
  }
  if (final.status === "complete") {
    const citation = distinctLine(run.citations);
    const estimate = distinctLine(run.estimates);
    if (citation !== null || estimate !== null) {
      emit(run, { type: "answer_meta", citation, estimate });
    }
    // Once, however many writes of the turn were refused, and after the words that led to it. Not when a write of
    // the turn landed: sending the message again would repeat it, and the model's words say what waits.
    if (run.askAgain && run.landedWrites === 0) {
      emit(run, { type: "ask_again" });
    }
  }
  try {
    await dependencies.turns.finishTurn(context.userId, context.turnId, final.status);
  } catch (caught) {
    dependencies.report("assistant", "internal_error", caught);
  }
  // Decided before `done`, so the person cannot start the next turn before the conversation is read, and run
  // after it, so the person never waits.
  const compaction = final.status === "complete" ? await planTurnCompaction(run) : null;
  switch (final.status) {
    case "complete":
    case "clarify":
    case "confirm":
      emit(run, { type: "done", outcome: final.status });
      break;
    case "refused":
    case "failed":
      // A refusal has no board of its own, so it uses the failed-turn notice.
      endAsFailed(stream);
      break;
    case "stopped":
      // Nobody is reading, so there is no `done`.
      break;
  }
  if (compaction !== null) {
    dependencies.runInBackground(compaction());
  }
  return final;
}

export function createRunTurn(
  dependencies: TurnDependencies,
  limits: TurnLimits = DEFAULT_LIMITS,
): RunTurn {
  return async (context, stream) => {
    const startedAt = performance.now();
    const run: Run = {
      context,
      startedAt,
      stream,
      signal: AbortSignal.any([stream.signal, context.request.signal]),
      limits,
      limitSignal: new AbortController(),
      limitCode: null,
      dependencies,
      counts: { modelCalls: 0, toolCalls: 0 },
      landedWrites: 0,
      lastErrorCode: null,
      askAgain: false,
      lastPromptTokens: null,
      unparseableInputRetries: 0,
      pendingCards: [],
      citations: [],
      estimates: [],
    };
    emit(run, {
      type: "turn",
      turnId: context.turnId,
      conversationId: context.conversationId,
    });
    // From the start of the turn, so the work before the first model call counts.
    const deadlineTimer = setTimeout(
      () => hitLimit(run, "turn_deadline"),
      limits.deadlineMilliseconds,
    );
    let reached: Ending;
    try {
      reached = await takeTurn(run);
    } catch (caught) {
      // A code and a stack, never the content: the error type is all the report keeps.
      dependencies.report("assistant", "internal_error", caught);
      reached = failedEnding("error");
    } finally {
      clearTimeout(deadlineTimer);
    }
    const final = await conclude(run, reached);
    const milliseconds = Math.round(performance.now() - startedAt);
    console.log(
      `assistant turn user=${context.userId} turn=${context.turnId} modelCalls=${run.counts.modelCalls} toolCalls=${run.counts.toolCalls} ending=${final.code} ${milliseconds}ms`,
    );
  };
}
