// The two reads the `mcp` function makes with the service client: the turn a request names, and the
// message that started it (its text and the person's own words). The service role is the only reader that sees these rows for any user
// (ADR 0003, Amendment 14), so every query is filtered by the user the function verified. A failure
// carries the operation and a Postgres error code, never the database message, which can quote a row.
import { z } from "zod";

import type { Database } from "../_shared/core/database.types.ts";
import type { SupabaseClient } from "@supabase/supabase-js";

// The values `assistant_turns_status_check` allows. Only `open` lets a request through.
export const turnStatuses = [
  "open",
  "complete",
  "clarify",
  "confirm",
  "stopped",
  "failed",
  "refused",
] as const;

export type TurnStatus = (typeof turnStatuses)[number];

export type McpTurn = {
  id: string;
  conversationId: string;
  userMessageId: string;
  status: TurnStatus;
  createdAt: Date;
};

export type McpTurnStore = {
  // The turn when it exists and belongs to the user, otherwise null.
  findTurn(userId: string, turnId: string): Promise<McpTurn | null>;
  // What the message that started the turn holds, in one read.
  userMessage(userId: string, turn: McpTurn): Promise<UserMessage>;
};

export type UserMessage = {
  // Every text block of the message joined, or null when it has none. It holds the context block, so it
  // is for the empty-message guard and the recipe link check, and never for what the person said.
  text: string | null;
  // The person's own words: the last block of the message, when that block is text. The loop stores the
  // message as the results of open calls, then the context block, then the person's words (`userContent`),
  // so the last block is never a tool result or the context block. Null when there is none.
  personsWords: string | null;
};

// Messages store the raw Messages API content: a list of blocks, the user's being text blocks.
const messageContentSchema = z.array(
  z.looseObject({ type: z.string(), text: z.string().optional() }),
);

// The text and the person's words of a stored user message. Content that is not a list of blocks has neither.
export function userMessageOf(rawContent: unknown): UserMessage {
  const content = messageContentSchema.safeParse(rawContent);
  if (!content.success) {
    return { text: null, personsWords: null };
  }
  const text = content.data
    .filter((block) => block.type === "text")
    .map((block) => block.text ?? "")
    .join("\n");
  const last = content.data.at(-1);
  const words = last?.type === "text" ? (last.text ?? "") : "";
  return {
    text: text === "" ? null : text,
    personsWords: words.trim() === "" ? null : words,
  };
}

function failure(operation: string, error: { code?: string }): Error {
  return new Error(`mcp turn store ${operation} failed ${error.code ?? "unknown"}`);
}

export function createMcpTurnStore(client: SupabaseClient<Database>): McpTurnStore {
  return {
    async findTurn(userId, turnId) {
      const { data, error } = await client
        .from("assistant_turns")
        .select("id, conversation_id, user_message_id, status, created_at")
        .eq("id", turnId)
        .eq("user_id", userId)
        .maybeSingle();
      if (error !== null) {
        throw failure("read a turn", error);
      }
      if (data === null) {
        return null;
      }
      const status = turnStatuses.find((known) => known === data.status);
      if (status === undefined) {
        throw failure("read a turn", { code: "unknown_status" });
      }
      return {
        id: data.id,
        conversationId: data.conversation_id,
        userMessageId: data.user_message_id,
        status,
        createdAt: new Date(data.created_at),
      };
    },

    async userMessage(userId, turn) {
      const { data, error } = await client
        .from("assistant_messages")
        .select("content")
        .eq("id", turn.userMessageId)
        .eq("user_id", userId)
        .maybeSingle();
      if (error !== null) {
        throw failure("read the user message", error);
      }
      return userMessageOf(data?.content);
    },
  };
}
