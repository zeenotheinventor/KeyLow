// Conversation compaction (KEY-706). The model remembers nothing between calls, so every turn sends the whole
// conversation again, and a long one costs more on every turn. Once the prompt of a finished turn passes a
// threshold, Ki-Lo asks Haiku once, with no tools, for a short note of what matters, stores it on the
// conversation, and from then on `toApiMessagesWithNote` sends the note in place of the turns it covers. What
// the person sees does not change: every message stays in the tables.
//
// Things to know when changing this file:
// - The note covers every turn up to the one that just ended and no tail of turns is kept word for word.
//   Haiku 5.5 ties a thinking block to the conversation that made it, so replaying the last few turns after a
//   note is a 400 unless their thinking is stripped. The note keeps the open questions, so the recent context
//   survives.
// - It runs only after a turn that ended `complete`, so a question waiting for an answer is never cut, and
//   only when no tool call is waiting for its result, so the cut is never inside a tool round.
// - The decision is made before `done` is written and the call after it, in the background. The store is a
//   compare-and-set on the conversation's `updated_at`, which `startTurn` moves, so a turn that began while
//   the note was written makes the store lose and the note is dropped. The next complete turn tries again.
// - The call runs after the response, outside the turn's deadline, so it has its own timeout and no retry.
// - Nothing here logs or reports the note, the transcript or a message.
import { readLimit } from "../_shared/rateLimit.ts";
import { buildCompactionRequest, renderTranscript } from "./compactPrompt.ts";
import { MODEL, openToolUses, toApiMessages } from "./prompt.ts";
import { NO_MESSAGE_ID } from "./turnStore.ts";

import type Anthropic from "@anthropic-ai/sdk";
import type { ReportError } from "../_shared/report.ts";
import type { CompactionState, TurnStore } from "./turnStore.ts";
import type { UsageToRecord } from "./usage.ts";

// A prompt of exactly this many tokens is not compacted, one more is. The prompt of a call is the tools, the
// system prompt and the conversation, so the tools and the system prompt come off this figure before the
// conversation gets any room. They are about 24,400 tokens now, which leaves about 17,600 for the
// conversation. It was 40,000 until KEY-952 added the Training questions section, and 20,000 before KEY-927,
// when they were the whole of it and every turn compacted.
// `promptPrefix.test.ts` fails when the prefix passes 60 % of this figure.
export const DEFAULT_COMPACT_AT_TOKENS = 42_000;

// The background call has no turn deadline around it. Its input is the conversation since the last note and
// not the tools or the system prompt, so normally about 17,000 tokens for a prompt at the threshold, and its
// output stops at COMPACTION_MAX_TOKENS (2,000), so a note takes several seconds on Haiku. 30 s is several
// times what it needs and short enough that the worker (150 s on the free plan) is not held for long. The
// call is made once: a failed one is tried again by the next complete turn, which is cheaper than a retry
// that holds the worker.
export const COMPACTION_TIMEOUT_MILLISECONDS = 30_000;

// What a compaction must not start without: its own timeout still inside the worker's wall clock.
export type CompactionDependencies = {
  turns: TurnStore;
  recordUsage(call: UsageToRecord): Promise<void>;
  createModelClient(): Anthropic | null;
  report: ReportError;
};

export type CompactionInput = {
  userId: string;
  conversationId: string;
  // The turn that just ended complete.
  turnId: string;
  // The prompt of that turn's last model call.
  promptTokens: number;
  // What the worker's wall clock has left once the turn is over.
  millisecondsLeft: number;
  timeoutMilliseconds: number;
};

// The prompt of a call as the API counts it: new tokens, tokens read from the cache and tokens written to it.
export const promptTokensOf = (usage: {
  input_tokens: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
}): number =>
  usage.input_tokens +
  (usage.cache_read_input_tokens ?? 0) +
  (usage.cache_creation_input_tokens ?? 0);

// Why a compaction ended without a note. It is the `code` of a log line and the name of the reported error.
type Result =
  | "stored"
  | "superseded"
  | "turn_missing"
  | "nothing_new"
  | "open_tool_use"
  | "not_configured"
  | "refused"
  | "note_too_long"
  | "empty_note"
  | "no_time_left"
  | "turn_open"
  | "failed";

class CompactionFailure extends Error {
  constructor(readonly code: Result) {
    super(code);
    this.name = "CompactionFailure";
  }
}

function log(input: CompactionInput, result: Result, noteTokens: number, startedAt: number): void {
  console.log(
    `assistant compaction conversation=${input.conversationId} turn=${input.turnId} promptTokens=${input.promptTokens} noteTokens=${noteTokens} result=${result} ${Math.round(performance.now() - startedAt)}ms`,
  );
}

// The rows the note has to cover: from the turn after the previous note to the end of this turn. The cut is
// by turn, so a run of user rows is never split. A turn that came after this one is left out.
function rowsToSummarise(
  messages: Awaited<ReturnType<TurnStore["readConversation"]>>["messages"],
  state: CompactionState,
  turnId: string,
) {
  const last = messages.findLastIndex((message) => message.turnId === turnId);
  const previousEnd =
    state.note === null
      ? -1
      : messages.findLastIndex((message) => message.turnId === state.note?.throughTurnId);
  return { last, rows: last === -1 ? [] : messages.slice(previousEnd + 1, last + 1) };
}

async function recordCall(
  dependencies: CompactionDependencies,
  input: CompactionInput,
  startedAt: number,
  message: Anthropic.Message | null,
): Promise<void> {
  await dependencies
    .recordUsage({
      userId: input.userId,
      turnId: input.turnId,
      route: "compact",
      model: MODEL,
      inputTokens: message?.usage.input_tokens ?? 0,
      outputTokens: message?.usage.output_tokens ?? 0,
      cacheReadInputTokens: message?.usage.cache_read_input_tokens ?? 0,
      cacheCreationInputTokens: message?.usage.cache_creation_input_tokens ?? 0,
      latencyMilliseconds: Math.round(performance.now() - startedAt),
      stopReason: message?.stop_reason ?? null,
    })
    .catch((recordFailure: unknown) =>
      dependencies.report("assistant", "internal_error", recordFailure),
    );
}

// Every opening or closing `conversation_summary` tag, in any case, with its attributes. The note is replayed
// inside that tag on every later turn, and it is model output built partly from untrusted tool results, so a
// closing tag in it would end the wrapper early and the text after it would read as outside the note. The tags
// are removed and the text around them is kept. A note that is nothing but tags is empty and is not stored.
const WRAPPER_TAG = /<\/?\s*conversation_summary[^>]*>?/gi;

// The note of one response: its text blocks, without wrapper tags, trimmed. The request has no tools and
// thinking is disabled, so text is all a response holds.
const noteOf = (message: Anthropic.Message): string =>
  message.content
    .flatMap((block) => (block.type === "text" ? [block.text] : []))
    .join("")
    .replaceAll(WRAPPER_TAG, "")
    .trim();

async function writeNote(
  dependencies: CompactionDependencies,
  input: CompactionInput,
  state: CompactionState,
): Promise<{ result: Result; noteTokens: number }> {
  const { turns } = dependencies;
  const { messages } = await turns.readConversation(input.userId, input.conversationId, {
    excludeMessageId: NO_MESSAGE_ID,
  });
  const { last, rows } = rowsToSummarise(messages, state, input.turnId);
  if (last === -1) {
    return { result: "turn_missing", noteTokens: 0 };
  }
  if (rows.length === 0) {
    return { result: "nothing_new", noteTokens: 0 };
  }
  // A call with no result yet would be cut off from its result by a note, which is a 400 on the next turn.
  if (openToolUses(messages.slice(0, last + 1)).length > 0) {
    return { result: "open_tool_use", noteTokens: 0 };
  }
  const client = dependencies.createModelClient();
  if (client === null) {
    throw new CompactionFailure("not_configured");
  }
  const request = buildCompactionRequest(
    renderTranscript({
      note: state.note?.summary ?? null,
      messages: toApiMessages(rows, input.turnId),
    }),
  );
  const startedAt = performance.now();
  let message: Anthropic.Message;
  try {
    message = await client.messages.create(request, {
      timeout: input.timeoutMilliseconds,
      maxRetries: 0,
      signal: AbortSignal.timeout(input.timeoutMilliseconds),
    });
  } catch (caught) {
    // The call failed before any usage arrived, and it is still one call.
    await recordCall(dependencies, input, startedAt, null);
    throw caught;
  }
  // Before the store, so a note that can be read always has its row.
  await recordCall(dependencies, input, startedAt, message);
  const noteTokens = message.usage.output_tokens;
  if (message.stop_reason === "refusal") {
    throw new CompactionFailure("refused");
  }
  if (message.stop_reason === "max_tokens") {
    throw new CompactionFailure("note_too_long");
  }
  const summary = noteOf(message);
  if (summary === "") {
    throw new CompactionFailure("empty_note");
  }
  const stored = await turns.storeCompaction(input.userId, input.conversationId, {
    summary,
    throughTurnId: input.turnId,
    seenUpdatedAt: state.updatedAt,
  });
  return { result: stored ? "stored" : "superseded", noteTokens };
}

// Decides, before the turn's `done` is written, whether this turn is compacted, and answers the work to run
// once it has been (hand it to `runInBackground`). Null when nothing is to be done. The conversation's
// `updated_at` is read here, before the person can send the next message, so any turn that starts after it
// makes the store lose. Never throws: a failure is reported and the turn ends as it would have.
export async function planCompaction(
  dependencies: CompactionDependencies,
  input: CompactionInput,
): Promise<(() => Promise<void>) | null> {
  const startedAt = performance.now();
  try {
    if (input.promptTokens <= readLimit("ASSISTANT_COMPACT_AT_TOKENS", DEFAULT_COMPACT_AT_TOKENS)) {
      return null;
    }
    if (input.millisecondsLeft < input.timeoutMilliseconds) {
      log(input, "no_time_left", 0, startedAt);
      return null;
    }
    const state = await dependencies.turns.readCompactionState(input.userId, input.conversationId);
    if (state.turnIsOpen) {
      log(input, "turn_open", 0, startedAt);
      return null;
    }
    return async () => {
      const workStartedAt = performance.now();
      try {
        const { result, noteTokens } = await writeNote(dependencies, input, state);
        log(input, result, noteTokens, workStartedAt);
      } catch (caught) {
        dependencies.report("assistant", "internal_error", caught);
        log(input, caught instanceof CompactionFailure ? caught.code : "failed", 0, workStartedAt);
      }
    };
  } catch (caught) {
    dependencies.report("assistant", "internal_error", caught);
    log(input, "failed", 0, startedAt);
    return null;
  }
}
