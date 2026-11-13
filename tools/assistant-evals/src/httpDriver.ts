import { parseAssistantEvent } from "@keylow/core";
import { localToday } from "@keylow/core/engine";

import type { SendMessageInput, TurnDriver } from "./driver.ts";
import type { AnswerMeta, Confirmation, ToolCall, TurnResult, TurnStatus } from "./types.ts";
import type {
  AssistantCard,
  AssistantExerciseFormMedia,
  AssistantExerciseMuscles,
  AssistantRecipeDraft,
  AssistantStreamEvent,
} from "@keylow/core";

export type HttpDriverOptions = Readonly<{
  /** The project's API address, such as `http://127.0.0.1:54321`. */
  apiUrl: string;
  anonKey: string;
  /** The eval user's JWT, asked for before every message so a refreshed one is picked up. */
  getAccessToken: () => Promise<string>;
  /** The eval user's time zone, which gives the day of a message. Null or unreadable counts as UTC. */
  timeZone: string | null;
  now?: () => Date;
  /**
   * The tool calls of a finished turn. The stream carries none, so the caller reads them from the turn's
   * stored messages as the eval user.
   */
  readToolCalls: (turnId: string) => Promise<readonly ToolCall[]>;
  /** How long one message may take, stream included. Defaults to the Edge Function's wall clock. */
  timeoutMilliseconds?: number;
}>;

/** The Edge Function's wall clock on the free plan (https://supabase.com/docs/guides/functions/limits). */
export const TURN_REQUEST_TIMEOUT_MILLISECONDS = 150_000;

// A failure names the status, the error code and the field paths of an event, and never a value: the
// text of a stream is the person's.
const failure = (what: string) => new Error(`The assistant stream failed: ${what}`);

const errorCodeOf = (body: string): string => {
  try {
    const parsed: unknown = JSON.parse(body);
    if (typeof parsed === "object" && parsed !== null && "error" in parsed) {
      const { error } = parsed;
      if (typeof error === "object" && error !== null && "code" in error) {
        return typeof error.code === "string" ? error.code : "unknown";
      }
    }
  } catch {
    // A body that is not JSON has no code to report.
  }
  return "unknown";
};

function readEvent(block: string): AssistantStreamEvent {
  const parsed = parseAssistantEvent(block.replace(/^data: /, ""));
  if (!parsed.ok) {
    throw failure(
      parsed.reason === "unknown_kind"
        ? `${parsed.reason} (${parsed.subject} ${parsed.kind})`
        : `${parsed.reason} at ${parsed.fieldPaths.join(", ") || "the line"}`,
    );
  }
  return parsed.event;
}

const statusOf = (outcome: "complete" | "clarify" | "confirm" | "failed"): TurnStatus => outcome;

/**
 * The HTTP `TurnDriver`: posts each message to the served `assistant` function as the eval user and reads
 * its Server-Sent Events with the core parser, until `done` arrives. A turn that ends `failed` is a result
 * with that status, which the runner reports. An event that does not parse, a stream that ends before
 * `done` and a refused call are errors.
 */
export function createHttpDriver(options: HttpDriverOptions): TurnDriver {
  const { apiUrl, anonKey, getAccessToken, timeZone, readToolCalls } = options;
  const now = options.now ?? (() => new Date());
  const timeoutMilliseconds = options.timeoutMilliseconds ?? TURN_REQUEST_TIMEOUT_MILLISECONDS;

  async function sendMessage({ conversationId, text }: SendMessageInput): Promise<TurnResult> {
    const response = await fetch(`${apiUrl}/functions/v1/assistant/turn`, {
      method: "POST",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${await getAccessToken()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        conversationId,
        text,
        localDate: localToday(now().toISOString(), timeZone),
        localTime: null,
      }),
      signal: AbortSignal.timeout(timeoutMilliseconds),
    });
    if (!response.ok || response.body === null) {
      throw failure(`the call answered ${response.status} ${errorCodeOf(await response.text())}`);
    }

    let turn: { turnId: string; conversationId: string } | null = null;
    let answer = "";
    let lastNoticeCode: string | null = null;
    let answerMeta: AnswerMeta | undefined;
    let confirmation: Confirmation | undefined;
    const cards: AssistantCard[] = [];
    const exerciseMuscles: AssistantExerciseMuscles[] = [];
    const exerciseFormMedia: AssistantExerciseFormMedia[] = [];
    const recipeDrafts: AssistantRecipeDraft[] = [];
    let buffer = "";
    const decoder = new TextDecoder();
    const reader = response.body.getReader();
    try {
      for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
        buffer += decoder.decode(chunk.value, { stream: true });
        const blocks = buffer.split("\n\n");
        buffer = blocks.pop() ?? "";
        for (const block of blocks.filter((candidate) => candidate !== "")) {
          const event = readEvent(block);
          if (event.type === "turn") {
            turn = { turnId: event.turnId, conversationId: event.conversationId };
          } else if (event.type === "text") {
            answer += event.delta;
          } else if (event.type === "answer_meta") {
            answerMeta = { citation: event.citation, estimate: event.estimate };
          } else if (event.type === "card") {
            cards.push(event.card);
          } else if (event.type === "exercise_muscles") {
            exerciseMuscles.push(event.exercise);
          } else if (event.type === "exercise_form_media") {
            exerciseFormMedia.push(event.exercise);
          } else if (event.type === "recipe_draft") {
            recipeDrafts.push(event.draft);
          } else if (event.type === "confirm") {
            const { question, confirmLabel, cancelLabel } = event;
            confirmation = { question, confirmLabel, cancelLabel };
          } else if (event.type === "notice") {
            // The code only, so a gate refusal is readable and nothing else of the notice is kept.
            lastNoticeCode = event.notice.code;
          } else if (event.type === "done") {
            if (turn === null) {
              throw failure("done arrived before the turn event");
            }
            return {
              ...turn,
              status: statusOf(event.outcome),
              answer,
              toolCalls: await readToolCalls(turn.turnId),
              ...(answerMeta === undefined ? {} : { answerMeta }),
              ...(confirmation === undefined ? {} : { confirmation }),
              ...(cards.length === 0 ? {} : { cards }),
              ...(exerciseMuscles.length === 0 ? {} : { exerciseMuscles }),
              ...(exerciseFormMedia.length === 0 ? {} : { exerciseFormMedia }),
              ...(recipeDrafts.length === 0 ? {} : { recipeDrafts }),
              ...(lastNoticeCode === null ? {} : { noticeCode: lastNoticeCode }),
            };
          }
        }
      }
    } finally {
      // A line that does not parse, or a done that came early, must not leave the function streaming.
      await reader.cancel().catch(() => undefined);
    }
    throw failure(
      lastNoticeCode === null
        ? "the stream ended before done"
        : `the stream ended before done, after the notice ${lastNoticeCode}`,
    );
  }

  return { sendMessage };
}
