// The second model of the palate judge (KEY-1037, M9 plan section 8). A rubric scores whether a recipe suits the
// person, and a model other than the one that wrote the recipe does the scoring. Haiku 5.5 is the model the repo
// already uses for its cheap tool-less calls (`RECIPE_PARSE_MODEL` in the assistant function), and the drafts are
// written by Opus 5.5, so the judge is a different model. It is never an input to a deterministic case.
//
// The judge takes a client, so no test calls a model: a test gives it a client by hand. The Anthropic client here
// makes one plain Messages call with the eval key, with no SDK (the package has none) and no retry. Its tokens are
// counted, because the harness counts only the rows of `assistant_usage` and the judge writes none. A failure
// names the status and the error type, never the body, because the body may echo a recipe.

export const JUDGE_MODEL = "claude-haiku-5-5";

/** Enough for the score and one line of reason, and no more. */
const JUDGE_MAX_OUTPUT_TOKENS = 400;

const JUDGE_TIMEOUT_MILLISECONDS = 30_000;

const ANTHROPIC_VERSION = "2023-06-01";

export type JudgeRequest = Readonly<{ system: string; user: string }>;

export type JudgeReply = Readonly<{ text: string; inputTokens: number; outputTokens: number }>;

/** One call to the judge model. The real one is `createAnthropicJudgeClient`, and a test gives its own. */
export type JudgeClient = Readonly<{ ask: (request: JudgeRequest) => Promise<JudgeReply> }>;

export type JudgeUsage = Readonly<{ calls: number; inputTokens: number; outputTokens: number }>;

export type Judge = Readonly<{
  /** The text of the judge's reply. */
  ask: (request: JudgeRequest) => Promise<string>;
  /** The input and output tokens of every call so far, which is what the run counts for the judge. */
  tokens: () => number;
  usage: () => JudgeUsage;
}>;

/** Wraps a client so that the tokens of every call that answered are counted. A call that failed counts nothing. */
export function createJudge(client: JudgeClient): Judge {
  let calls = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  return {
    ask: async (request) => {
      const reply = await client.ask(request);
      calls += 1;
      inputTokens += reply.inputTokens;
      outputTokens += reply.outputTokens;
      return reply.text;
    },
    tokens: () => inputTokens + outputTokens,
    usage: () => ({ calls, inputTokens, outputTokens }),
  };
}

export type AnthropicJudgeClientOptions = Readonly<{
  /** Read when a call is made, so a run that never judges needs no key. */
  apiKey: () => string | undefined;
  /** For a test. Defaults to the Anthropic API. */
  baseUrl?: string;
}>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const errorTypeOf = (body: unknown): string =>
  isRecord(body) && isRecord(body["error"]) && typeof body["error"]["type"] === "string"
    ? body["error"]["type"]
    : "unknown";

function textOf(body: unknown): string {
  const blocks = isRecord(body) && Array.isArray(body["content"]) ? body["content"] : [];
  return blocks
    .flatMap((block: unknown) =>
      isRecord(block) && block["type"] === "text" && typeof block["text"] === "string"
        ? [block["text"]]
        : [],
    )
    .join("");
}

function tokensOf(body: unknown): { inputTokens: number; outputTokens: number } | null {
  const usage = isRecord(body) ? body["usage"] : undefined;
  return isRecord(usage) &&
    typeof usage["input_tokens"] === "number" &&
    typeof usage["output_tokens"] === "number"
    ? { inputTokens: usage["input_tokens"], outputTokens: usage["output_tokens"] }
    : null;
}

export function createAnthropicJudgeClient(options: AnthropicJudgeClientOptions): JudgeClient {
  const baseUrl = options.baseUrl ?? "https://api.anthropic.com";
  return {
    ask: async ({ system, user }) => {
      const apiKey = (options.apiKey() ?? "").trim();
      if (apiKey === "") {
        throw new Error("The judge cannot call: ANTHROPIC_API_KEY is not set");
      }
      const response = await fetch(`${baseUrl}/v1/messages`, {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": ANTHROPIC_VERSION,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: JUDGE_MODEL,
          max_tokens: JUDGE_MAX_OUTPUT_TOKENS,
          system,
          messages: [{ role: "user", content: user }],
        }),
        signal: AbortSignal.timeout(JUDGE_TIMEOUT_MILLISECONDS),
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(`The judge call failed: ${response.status} ${errorTypeOf(body)}`);
      }
      const text = textOf(body);
      if (text === "") {
        throw new Error("The judge call answered no text");
      }
      const tokens = tokensOf(body);
      if (tokens === null) {
        throw new Error("The judge call answered no token counts");
      }
      return { text, ...tokens };
    },
  };
}
