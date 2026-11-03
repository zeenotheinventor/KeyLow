import type { CaseEnvironment, SeedTurn } from "./case.ts";
import type { Database } from "@keylow/api-client";
import type { SupabaseClient } from "@supabase/supabase-js";

// What a case may do to the eval user's data that the eval user cannot do for itself. Only the service role
// writes the conversation tables (ADR 0003, Amendment 14), so this takes the run's service client. An error
// names the action and the database's code, never a row, because a message is health data.

// A compaction takes a few seconds on Haiku, and the case itself has a 120 s ceiling, so a note that has not
// arrived after 60 s has failed.
const DEFAULT_COMPACTION_TIMEOUT_MILLISECONDS = 60_000;
const DEFAULT_POLL_INTERVAL_MILLISECONDS = 1_000;

export type CaseEnvironmentOptions = Readonly<{
  /** The service client of the run. */
  client: SupabaseClient<Database>;
  /** The eval user, whose conversation this is. */
  userId: string;
  compactionTimeoutMilliseconds?: number;
  pollIntervalMilliseconds?: number;
}>;

const failure = (action: string, error: { code: string }) =>
  new Error(`Could not ${action} (${error.code})`);

const textMessage = (text: string) => [{ type: "text", text }];

export function createCaseEnvironment({
  client,
  userId,
  compactionTimeoutMilliseconds = DEFAULT_COMPACTION_TIMEOUT_MILLISECONDS,
  pollIntervalMilliseconds = DEFAULT_POLL_INTERVAL_MILLISECONDS,
}: CaseEnvironmentOptions): CaseEnvironment {
  async function seedConversation(seedTurns: readonly SeedTurn[]): Promise<string> {
    const { data: conversation, error: conversationError } = await client
      .from("assistant_conversations")
      .insert({ user_id: userId })
      .select("id")
      .single();
    if (conversationError) {
      throw failure("seed a conversation", conversationError);
    }
    const conversationId = conversation.id;

    const turns = seedTurns.map((seedTurn) => ({
      seedTurn,
      turnId: crypto.randomUUID(),
      userMessageId: crypto.randomUUID(),
    }));
    const finishedAt = new Date().toISOString();
    const { error: turnsError } = await client.from("assistant_turns").insert(
      turns.map(({ turnId, userMessageId }) => ({
        id: turnId,
        conversation_id: conversationId,
        user_id: userId,
        user_message_id: userMessageId,
        status: "complete",
        finished_at: finishedAt,
      })),
    );
    if (turnsError) {
      throw failure("seed the turns", turnsError);
    }

    const { error: messagesError } = await client.from("assistant_messages").insert(
      turns.flatMap(({ seedTurn, turnId, userMessageId }, index) => [
        {
          id: userMessageId,
          conversation_id: conversationId,
          turn_id: turnId,
          user_id: userId,
          role: "user",
          content: textMessage(seedTurn.user),
          seq: index * 2 + 1,
        },
        {
          conversation_id: conversationId,
          turn_id: turnId,
          user_id: userId,
          role: "assistant",
          content: textMessage(seedTurn.assistant),
          seq: index * 2 + 2,
        },
      ]),
    );
    if (messagesError) {
      throw failure("seed the messages", messagesError);
    }
    return conversationId;
  }

  async function waitForCompaction(conversationId: string): Promise<void> {
    const deadline = Date.now() + compactionTimeoutMilliseconds;
    for (;;) {
      const { data, error } = await client
        .from("assistant_conversations")
        .select("compaction_summary")
        .eq("id", conversationId)
        .maybeSingle();
      if (error) {
        throw failure("read the compaction note", error);
      }
      if (data?.compaction_summary != null) {
        return;
      }
      if (Date.now() >= deadline) {
        throw new Error(`no compaction note was stored within ${compactionTimeoutMilliseconds} ms`);
      }
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMilliseconds));
    }
  }

  return { seedConversation, waitForCompaction };
}
