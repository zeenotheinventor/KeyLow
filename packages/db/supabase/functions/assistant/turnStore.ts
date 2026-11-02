// The conversation and turn rows the `turn` and `conversations` routes write. The service role is the
// only writer of these tables (ADR 0003, Amendment 14), so every query here is filtered by the user
// the function verified.
import type { Database } from "../_shared/core/database.types.ts";
import type { SupabaseClient } from "@supabase/supabase-js";

export type TurnStore = {
  createConversation(userId: string): Promise<string>;
  ownsConversation(userId: string, conversationId: string): Promise<boolean>;
  // Inserts the turn and the user's message, and answers the turn's id.
  startTurn(input: { userId: string; conversationId: string; text: string }): Promise<string>;
};

function failure(operation: string, error: { code?: string } | null): Error {
  return new Error(`assistant turn store ${operation} failed ${error?.code ?? "unknown"}`);
}

async function storeUserMessage(
  client: SupabaseClient<Database>,
  input: {
    userId: string;
    conversationId: string;
    text: string;
    turnId: string;
    userMessageId: string;
  },
): Promise<void> {
  const { userId, conversationId, text, turnId, userMessageId } = input;
  const { data: last, error: seqError } = await client
    .from("assistant_messages")
    .select("seq")
    .eq("conversation_id", conversationId)
    .order("seq", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (seqError !== null) {
    throw failure("read the last message", seqError);
  }
  const { error: messageError } = await client.from("assistant_messages").insert({
    id: userMessageId,
    conversation_id: conversationId,
    turn_id: turnId,
    user_id: userId,
    role: "user",
    content: [{ type: "text", text }],
    seq: (last?.seq ?? 0) + 1,
  });
  if (messageError !== null) {
    throw failure("insert the user message", messageError);
  }
  // The writer sets `updated_at`, and compaction compares it before it stores a note.
  const { error: bumpError } = await client
    .from("assistant_conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId)
    .eq("user_id", userId);
  if (bumpError !== null) {
    throw failure("touch the conversation", bumpError);
  }
}

export function createTurnStore(client: SupabaseClient<Database>): TurnStore {
  return {
    async createConversation(userId) {
      const { data, error } = await client
        .from("assistant_conversations")
        .insert({ user_id: userId })
        .select("id")
        .single();
      if (error !== null) {
        throw failure("create a conversation", error);
      }
      return data.id;
    },

    async ownsConversation(userId, conversationId) {
      const { data, error } = await client
        .from("assistant_conversations")
        .select("id")
        .eq("id", conversationId)
        .eq("user_id", userId)
        .maybeSingle();
      if (error !== null) {
        throw failure("read a conversation", error);
      }
      return data !== null;
    },

    async startTurn({ userId, conversationId, text }) {
      const userMessageId = crypto.randomUUID();
      const { data: turn, error: turnError } = await client
        .from("assistant_turns")
        .insert({
          conversation_id: conversationId,
          user_id: userId,
          user_message_id: userMessageId,
        })
        .select("id")
        .single();
      if (turnError !== null) {
        throw failure("insert a turn", turnError);
      }
      try {
        await storeUserMessage(client, {
          userId,
          conversationId,
          text,
          turnId: turn.id,
          userMessageId,
        });
      } catch (caught) {
        // No open turn is left behind. The result is not checked: the original failure is the one to throw.
        await client
          .from("assistant_turns")
          .update({ status: "failed", finished_at: new Date().toISOString() })
          .eq("id", turn.id)
          .eq("user_id", userId);
        throw caught;
      }
      return turn.id;
    },
  };
}
