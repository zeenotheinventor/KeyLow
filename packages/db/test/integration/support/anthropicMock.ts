// The test side of the Messages API mock: how a test scripts the model's replies and reads back the
// requests the `assistant` function made. The server is in offMockServer.ts, under /anthropic on the
// same port as the Open Food Facts mock. A script is keyed by a marker the test puts in its user text,
// so parallel suites never mix: a request belongs to the script whose marker its body contains.

import { offMockPort } from "./offMock";

export type ScriptedBlock =
  { type: "text"; text: string } | { type: "tool_use"; id: string; name: string; input: unknown };

export type ScriptedReply = {
  blocks: ScriptedBlock[];
  stopReason: "end_turn" | "tool_use" | "max_tokens" | "refusal";
  usage?: {
    input?: number;
    output?: number;
    cacheRead?: number;
    cacheCreation?: number;
  };
};

export type ModelRequestBody = Record<string, unknown>;

export type AnthropicMockClient = {
  /** Replies to the requests carrying `marker`, one reply for each request, in order. */
  script: (marker: string, replies: ScriptedReply[]) => Promise<void>;
  /** The JSON body of every request that carried `marker`, in the order they arrived. */
  requests: (marker: string) => Promise<ModelRequestBody[]>;
  /** Forgets the script and the requests of `marker`. */
  forget: (marker: string) => Promise<void>;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const stopReasons: readonly unknown[] = ["end_turn", "tool_use", "max_tokens", "refusal"];

function isScriptedBlock(value: unknown): value is ScriptedBlock {
  if (!isRecord(value)) {
    return false;
  }
  if (value["type"] === "text") {
    return typeof value["text"] === "string";
  }
  return (
    value["type"] === "tool_use" &&
    typeof value["id"] === "string" &&
    typeof value["name"] === "string"
  );
}

/** Whether the server was sent a list of replies it can stream. */
export function isScriptedReplyList(value: unknown): value is ScriptedReply[] {
  return (
    Array.isArray(value) &&
    value.every(
      (reply: unknown) =>
        isRecord(reply) &&
        Array.isArray(reply["blocks"]) &&
        reply["blocks"].every(isScriptedBlock) &&
        stopReasons.includes(reply["stopReason"]) &&
        (reply["usage"] === undefined || isRecord(reply["usage"])),
    )
  );
}

function isRequestList(value: unknown): value is ModelRequestBody[] {
  return Array.isArray(value) && value.every(isRecord);
}

export function createAnthropicMockClient(baseUrl: string): AnthropicMockClient {
  async function send(path: string, init?: RequestInit): Promise<Response> {
    const response = await fetch(`${baseUrl}${path}`, init);
    if (!response.ok) {
      throw new Error(
        `Messages API mock ${path} answered ${response.status}: ${await response.text()}`,
      );
    }
    return response;
  }
  const post = (path: string, body: unknown) =>
    send(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

  return {
    async script(marker, replies) {
      await post("/__mock/anthropic/register", { marker, replies });
    },
    async requests(marker) {
      const response = await send(
        `/__mock/anthropic/requests?marker=${encodeURIComponent(marker)}`,
      );
      const requests: unknown = await response.json();
      if (!isRequestList(requests)) {
        throw new Error("The Messages API mock answered requests in an unexpected shape");
      }
      return requests;
    },
    async forget(marker) {
      await post("/__mock/anthropic/forget", { marker });
    },
  };
}

/** The mock the global setup started, for the test files. */
export const anthropicMock = createAnthropicMockClient(`http://127.0.0.1:${offMockPort}`);
