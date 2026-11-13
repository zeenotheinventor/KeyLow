// The generation call of the kitchen tools (ADR 0006, Amendment 6): one tool-less Opus 5.5 structured-output
// call inside a tool, the same shape as the import's parse call in `recipeParse.ts`. The chat turn loop stays on
// Haiku. Opus proposes structure, and `@keylow/core` computes every number from what it proposes.
//
// Things to know when changing this file:
// - The caller wraps the person's words and palate in `<untrusted_data>` (`wrapUntrusted`) and writes the system
//   prompt. The call has no tools, so nothing in the data can make anything happen. The answer is read by the
//   caller's `read`, a core reader that bounds every string and array and checks every position and id against
//   what the tool offered. An answer it does not accept is `generation_failed`, never a partial one.
// - Opus 5.5 cannot have thinking disabled, so `thinking` is left out and `output_config.effort` is `low`, set
//   explicitly because the default is `medium`. There is no `temperature`, `top_p`, `top_k`, `tool_choice`,
//   prefill, `inference_geo` or `output_format` key (a forced tool choice and the sampling keys are a 400).
// - `fallbacks: "default"` with the beta `server-side-fallback-2026-07-01` lets the API serve a refused request
//   from another model. A final `stop_reason: "refusal"` means the whole chain refused, which is
//   `generation_refused`. A fallback may have answered, so each usage row names the model of its attempt.
//   The answer is read from the text after the last `fallback` block only. A model that
//   `usage.ts` has no price for is recorded under Opus 5.5 instead, because the row must still count against
//   the monthly cap and Opus is the dearest model a request can start on.
// - The call is made once, with no retry and a 40 s timeout, inside the turn loop's 55 s call timeout for a
//   generation tool. One `assistant_usage` row is written for every call that was made, failed or not. When the response carries
//   `usage.iterations` there is one row for each attempt, each with its own model and tokens.
// - A missing key is `generation_failed` with no call and no row, never a throw.
// - Nothing here logs or reports data, a reply or a reason. A reported error is the SDK's or the database's.
import Anthropic from "@anthropic-ai/sdk";

import { toStrictJsonSchema } from "./tool.ts";

import type { ZodType } from "zod";
import type { ReportError } from "../report.ts";

export const GENERATION_MODEL = "claude-opus-5-5";

// A suggestion is about 700 tokens, a substitution about 300 and a plan ranking about 600, and thinking at
// effort low adds an estimated 500 to 1,500.
export const GENERATION_MAX_TOKENS = 3_000;

// Inside the 55 s the turn loop allows a generation tool, with room for what the tool does after the call.
export const GENERATION_TIMEOUT_MILLISECONDS = 40_000;

const FALLBACK_BETA = "server-side-fallback-2026-07-01";

export type GenerationRoute = "recipe_generate" | "plan_generate";

export type GenerationFailure = "generation_refused" | "generation_timeout" | "generation_failed";

export type GenerationRequest<Value> = {
  route: GenerationRoute;
  userId: string;
  turnId: string;
  system: string;
  /** The user message, already wrapped with `wrapUntrusted`. */
  userContent: string;
  /** The schema the model's answer is held to, sent as `output_config.format`. */
  format: ZodType;
  /** The value of the answer, or null when it does not fit what the tool offered. */
  read(reply: unknown): Value | null;
  /** Defaults to `GENERATION_TIMEOUT_MILLISECONDS`. */
  timeoutMilliseconds?: number;
};

/** `model` is the one that answered, which a fallback may have made a different one. */
export type GenerationOutcome<Value> =
  { ok: true; value: Value; model: string } | { ok: false; code: GenerationFailure };

export type GenerationUsage = {
  userId: string;
  turnId: string;
  route: GenerationRoute;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
  latencyMilliseconds: number;
  stopReason: string | null;
};

export type GenerationServices = {
  generate<Value>(request: GenerationRequest<Value>): Promise<GenerationOutcome<Value>>;
};

export type GenerationDependencies = {
  readEnv(name: string): string | undefined;
  recordUsage(call: GenerationUsage): Promise<void>;
  report: ReportError;
  /** The models `recordUsage` can price. Anything else is recorded under `GENERATION_MODEL`. */
  hasPrice(model: string): boolean;
};

// Only the text after the last `fallback` block: what a declined hop wrote before the handover is not the answer.
function textOf(message: Anthropic.Beta.BetaMessage): string {
  let text = "";
  for (const block of message.content) {
    if (block.type === "fallback") {
      text = "";
    } else if (block.type === "text") {
      text += block.text;
    }
  }
  return text;
}

function jsonOf(message: Anthropic.Beta.BetaMessage): unknown {
  try {
    return JSON.parse(textOf(message));
  } catch {
    return undefined;
  }
}

type AttemptCounts = {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
};

// What each attempt was billed. `usage.iterations` is the per-attempt source of truth when it is present: a
// declined hop is a `message` entry and the fallback that served is a `fallback_message` entry with its own model,
// while the top-level `usage` covers only the attempt that produced the returned message.
function attemptsOf(message: Anthropic.Beta.BetaMessage): AttemptCounts[] {
  const attempts = (message.usage.iterations ?? []).flatMap((iteration) =>
    iteration.type === "message" || iteration.type === "fallback_message"
      ? [
          {
            model: iteration.model ?? GENERATION_MODEL,
            inputTokens: iteration.input_tokens,
            outputTokens: iteration.output_tokens,
            cacheReadInputTokens: iteration.cache_read_input_tokens,
            cacheCreationInputTokens: iteration.cache_creation_input_tokens,
          },
        ]
      : [],
  );
  return attempts.length > 0
    ? attempts
    : [
        {
          model: message.model,
          inputTokens: message.usage.input_tokens,
          outputTokens: message.usage.output_tokens,
          cacheReadInputTokens: message.usage.cache_read_input_tokens ?? 0,
          cacheCreationInputTokens: message.usage.cache_creation_input_tokens ?? 0,
        },
      ];
}

const isTimeout = (caught: unknown): boolean =>
  caught instanceof Anthropic.APIConnectionTimeoutError ||
  // The only abort here is this call's own timeout signal.
  caught instanceof Anthropic.APIUserAbortError;

export function createGenerationServices(dependencies: GenerationDependencies): GenerationServices {
  return {
    async generate<Value>(request: GenerationRequest<Value>): Promise<GenerationOutcome<Value>> {
      const apiKey = dependencies.readEnv("ANTHROPIC_API_KEY");
      if (apiKey === undefined || apiKey.trim() === "") {
        return { ok: false, code: "generation_failed" };
      }
      const baseURL = dependencies.readEnv("ANTHROPIC_BASE_URL");
      const client = new Anthropic({
        apiKey,
        ...(baseURL === undefined || baseURL === "" ? {} : { baseURL }),
        // Once: a retry would spend the tool's whole budget on one call, and a call is paid for.
        maxRetries: 0,
        // The SDK logs the raw data of a stream event it cannot parse, and that is the person's data.
        logLevel: "off",
      });
      const timeoutMilliseconds = request.timeoutMilliseconds ?? GENERATION_TIMEOUT_MILLISECONDS;
      const startedAt = performance.now();
      let message: Anthropic.Beta.BetaMessage | null = null;
      let failure: unknown = null;
      try {
        message = await client.beta.messages.create(
          {
            model: GENERATION_MODEL,
            max_tokens: GENERATION_MAX_TOKENS,
            betas: [FALLBACK_BETA],
            fallbacks: "default",
            output_config: {
              effort: "low",
              format: { type: "json_schema", schema: toStrictJsonSchema(request.format) },
            },
            system: request.system,
            messages: [{ role: "user", content: request.userContent }],
          },
          { timeout: timeoutMilliseconds, signal: AbortSignal.timeout(timeoutMilliseconds) },
        );
      } catch (caught) {
        failure = caught;
      }
      const answeredBy = message?.model ?? GENERATION_MODEL;
      const latencyMilliseconds = Math.round(performance.now() - startedAt);
      const attempts: AttemptCounts[] =
        message === null
          ? [
              {
                model: GENERATION_MODEL,
                inputTokens: 0,
                outputTokens: 0,
                cacheReadInputTokens: 0,
                cacheCreationInputTokens: 0,
              },
            ]
          : attemptsOf(message);
      // One row for each attempt that was billed, so a declined Opus hop is counted at Opus rates beside the
      // fallback that served. The last row holds the call's stop reason, and a hop before it was declined.
      for (const [index, attempt] of attempts.entries()) {
        await dependencies
          .recordUsage({
            userId: request.userId,
            turnId: request.turnId,
            route: request.route,
            ...attempt,
            model: dependencies.hasPrice(attempt.model) ? attempt.model : GENERATION_MODEL,
            latencyMilliseconds,
            stopReason: index === attempts.length - 1 ? (message?.stop_reason ?? null) : "refusal",
          })
          .catch((recordFailure: unknown) =>
            dependencies.report("mcp", "internal_error", recordFailure),
          );
      }
      if (message === null) {
        dependencies.report("mcp", "upstream_error", failure);
        return { ok: false, code: isTimeout(failure) ? "generation_timeout" : "generation_failed" };
      }
      if (message.stop_reason === "refusal") {
        return { ok: false, code: "generation_refused" };
      }
      if (message.stop_reason === "max_tokens") {
        return { ok: false, code: "generation_failed" };
      }
      const value = request.read(jsonOf(message));
      return value === null
        ? { ok: false, code: "generation_failed" }
        : { ok: true, value, model: answeredBy };
    },
  };
}
