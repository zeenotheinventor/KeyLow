// The two reads the `mcp` function makes with the service client: the turn a request names, and the
// message that started it. The service role is the only reader that sees these rows for any user
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
  // The text of the message that started the turn, or null when it has none.
  userMessageText(userId: string, turn: McpTurn): Promise<string | null>;
};

// Messages store the raw Messages API content: a list of blocks, the user's being text blocks.
const messageContentSchema = z.array(
  z.looseObject({ type: z.string(), text: z.string().optional() }),
);

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

    async userMessageText(userId, turn) {
      const { data, error } = await client
        .from("assistant_messages")
        .select("content")
        .eq("id", turn.userMessageId)
        .eq("user_id", userId)
        .maybeSingle();
      if (error !== null) {
        throw failure("read the user message", error);
      }
      const content = messageContentSchema.safeParse(data?.content);
      if (!content.success) {
        return null;
      }
      const text = content.data
        .filter((block) => block.type === "text")
        .map((block) => block.text ?? "")
        .join("\n");
      return text === "" ? null : text;
    },
  };
}
