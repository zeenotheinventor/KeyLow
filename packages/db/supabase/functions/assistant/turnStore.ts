// The conversation, turn and message rows the `assistant` function writes and reads. The service role
// is the only writer of these tables (ADR 0003, Amendment 14), so every query here is filtered by the
// user the function verified. Failures carry the action and a code, never a row, because a message is
// health data.
import { z } from "zod";

import type { AssistantStoredMessage, AssistantTurnStatus } from "../_shared/core.ts";
import type { Database, Json } from "../_shared/core/database.types.ts";
import type { SupabaseClient } from "@supabase/supabase-js";

export type NewMessage = {
  role: "user" | "assistant";
  // The Messages API content blocks, exactly as the model saw or wrote them.
  content: Json;
  // What the app draws under a tool result, keyed by `tool_use_id`, or null (Amendment 14 addendum).
  display?: Json | null;
};

// `readConversation` leaves out one message. A nil id is on no row, so the whole conversation is read.
export const NO_MESSAGE_ID = "00000000-0000-0000-0000-000000000000";

export type FinalTurnStatus = Exclude<AssistantTurnStatus, "open">;

export type StoredMessage = Omit<AssistantStoredMessage, "turnStatus">;

export type PreviousTurn = {
  status: AssistantTurnStatus;
  // The tool the turn was waiting on a confirmation for, from `pending_confirmation`.
  pendingTool: string | null;
  // The id of that confirmation, which leads to the stored call that asked it (KEY-840). Null for a row
  // that holds none.
  pendingConfirmationId: string | null;
  // The words of the button that confirms it, from the same row. Null for a row written before they were kept.
  pendingConfirmLabel: string | null;
};

// Ki-Lo's note of the turns up to and including `throughTurnId`, as `assistant_conversations` stores it
// (KEY-706). The replay in `prompt.ts` sends it in place of those turns.
export type ConversationNote = { summary: string; throughTurnId: string };

// What compaction reads before it decides to run: the stored note, the `updated_at` the conversation had
// then (the value the store compares against), and whether a turn is running.
export type CompactionState = {
  note: ConversationNote | null;
  updatedAt: string;
  turnIsOpen: boolean;
};

export type TurnStore = {
  createConversation(userId: string): Promise<string>;
  ownsConversation(userId: string, conversationId: string): Promise<boolean>;
  // Inserts the turn and the user's message. Throws `ConversationBusyError` while the conversation has
  // an open turn younger than the turn window.
  startTurn(input: {
    userId: string;
    conversationId: string;
    text: string;
  }): Promise<{ turnId: string; userMessageId: string }>;
  // Adds messages after the conversation's last `seq`, in one insert.
  appendMessages(
    userId: string,
    conversationId: string,
    turnId: string,
    messages: NewMessage[],
  ): Promise<void>;
  // Replaces the content `startTurn` stored with the blocks the model is about to see.
  setUserMessageContent(userId: string, messageId: string, content: Json): Promise<void>;
  readConversation(
    userId: string,
    conversationId: string,
    options: { excludeMessageId: string },
  ): Promise<{
    messages: StoredMessage[];
    previousTurn: PreviousTurn | null;
    // The note the replay sends in place of the turns it covers, or null before the first compaction.
    compaction: ConversationNote | null;
  }>;
  readCompactionState(userId: string, conversationId: string): Promise<CompactionState>;
  // Stores the note and the turn it runs up to, only if the conversation's `updated_at` is still the value
  // compaction saw, and writes a new one. A turn that started since has moved it, so the answer is false and
  // nothing changed. `assistant_messages` is never written.
  storeCompaction(
    userId: string,
    conversationId: string,
    input: { summary: string; throughTurnId: string; seenUpdatedAt: string },
  ): Promise<boolean>;
  readTimeZone(userId: string): Promise<string>;
  // Sets the status only while the turn is open, so a late ending never overwrites the first.
  finishTurn(userId: string, turnId: string, status: FinalTurnStatus): Promise<void>;
  // Whether the turn has an `assistant_actions` row. The `TurnHasAction` that `connectToolServer` takes.
  turnHasAction(turnId: string): Promise<boolean>;
};

// A second turn on a conversation that already has a running one.
export class ConversationBusyError extends Error {
  constructor() {
    super("assistant conversation is busy");
  }
}

// The `mcp` function binds a tool call to a turn for 5 minutes from `created_at`, so an open turn
// older than that cannot still be working.
const turnWindowMilliseconds = 5 * 60 * 1000;
// PostgREST returns at most 1,000 rows per request.
const pageSize = 1000;
const seqKeyName = "assistant_messages_conversation_id_seq_key";

const turnStatuses = [
  "open",
  "complete",
  "clarify",
  "confirm",
  "stopped",
  "failed",
  "refused",
] as const satisfies readonly AssistantTurnStatus[];
const roles = ["user", "assistant"] as const;

const pendingToolSchema = z.object({
  id: z.string().optional(),
  tool: z.string(),
  confirm_label: z.string().optional(),
});

function failure(operation: string, error: { code?: string } | null): Error {
  return new Error(`assistant turn store ${operation} failed ${error?.code ?? "unknown"}`);
}

type MessageToInsert = NewMessage & { id?: string };

export type TurnStoreOptions = { now?: () => Date };

export function createTurnStore(
  client: SupabaseClient<Database>,
  { now = () => new Date() }: TurnStoreOptions = {},
): TurnStore {
  // A 23505 on any other key is a real fault, not a lost race.
  function isSeqCollision(error: { code?: string; message?: string }): boolean {
    return error.code === "23505" && (error.message ?? "").includes(seqKeyName);
  }

  async function lastSeq(conversationId: string): Promise<number> {
    const { data, error } = await client
      .from("assistant_messages")
      .select("seq")
      .eq("conversation_id", conversationId)
      .order("seq", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error !== null) {
      throw failure("read the last message", error);
    }
    return data?.seq ?? 0;
  }

  // The one writer of `seq`. Two sends on one conversation can read the same last value, and the unique
  // key then refuses the second insert. Reading again and inserting once more fixes that, and a second
  // refusal is a fault worth surfacing.
  async function insertMessages(
    userId: string,
    conversationId: string,
    turnId: string,
    messages: MessageToInsert[],
  ): Promise<void> {
    if (messages.length === 0) {
      return;
    }
    for (const attempt of [1, 2]) {
      const last = await lastSeq(conversationId);
      const { error } = await client.from("assistant_messages").insert(
        messages.map((message, index) => ({
          ...(message.id === undefined ? {} : { id: message.id }),
          conversation_id: conversationId,
          turn_id: turnId,
          user_id: userId,
          role: message.role,
          content: message.content,
          display: message.display ?? null,
          seq: last + 1 + index,
        })),
      );
      if (error === null) {
        return;
      }
      if (attempt === 2 || !isSeqCollision(error)) {
        throw failure("insert messages", error);
      }
    }
  }

  // The writer sets `updated_at`, and compaction compares it before it stores a note.
  async function touchConversation(userId: string, conversationId: string): Promise<void> {
    const { error } = await client
      .from("assistant_conversations")
      .update({ updated_at: now().toISOString() })
      .eq("id", conversationId)
      .eq("user_id", userId);
    if (error !== null) {
      throw failure("touch the conversation", error);
    }
  }

  async function refuseWhileBusy(userId: string, conversationId: string): Promise<void> {
    const cutoff = new Date(now().getTime() - turnWindowMilliseconds).toISOString();
    const { error: staleError } = await client
      .from("assistant_turns")
      .update({ status: "failed", finished_at: now().toISOString() })
      .eq("conversation_id", conversationId)
      .eq("user_id", userId)
      .eq("status", "open")
      .lt("created_at", cutoff);
    if (staleError !== null) {
      throw failure("fail stale turns", staleError);
    }
    const { data, error } = await client
      .from("assistant_turns")
      .select("id")
      .eq("conversation_id", conversationId)
      .eq("user_id", userId)
      .eq("status", "open")
      .limit(1);
    if (error !== null) {
      throw failure("read open turns", error);
    }
    if (data.length > 0) {
      throw new ConversationBusyError();
    }
  }

  // Two sends at the same instant both pass `refuseWhileBusy` and insert a turn. Looking again once the
  // turn is stored settles it: the oldest open turn (ties broken by id) keeps going, and the other
  // side throws, so exactly one of them loses.
  async function refuseWhenOlderTurnIsOpen(
    userId: string,
    conversationId: string,
    turnId: string,
  ): Promise<void> {
    const { data, error } = await client
      .from("assistant_turns")
      .select("id")
      .eq("conversation_id", conversationId)
      .eq("user_id", userId)
      .eq("status", "open")
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(1);
    if (error !== null) {
      throw failure("read open turns again", error);
    }
    if (data[0]?.id !== turnId) {
      throw new ConversationBusyError();
    }
  }

  async function readMessages(
    userId: string,
    conversationId: string,
    excludeMessageId: string,
  ): Promise<StoredMessage[]> {
    const messages: StoredMessage[] = [];
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await client
        .from("assistant_messages")
        .select("id, turn_id, role, content, display")
        .eq("conversation_id", conversationId)
        .eq("user_id", userId)
        .neq("id", excludeMessageId)
        .order("seq", { ascending: true })
        .range(from, from + pageSize - 1);
      if (error !== null) {
        throw failure("read messages", error);
      }
      for (const row of data) {
        const role = roles.find((candidate) => candidate === row.role);
        if (role === undefined) {
          throw failure("read a message role", null);
        }
        messages.push({
          id: row.id,
          turnId: row.turn_id,
          role,
          content: row.content,
          display: row.display,
        });
      }
      if (data.length < pageSize) {
        return messages;
      }
    }
  }

  // The latest turn that is not the one being started, found by the message that started it.
  async function readPreviousTurn(
    userId: string,
    conversationId: string,
    excludeMessageId: string,
  ): Promise<PreviousTurn | null> {
    const { data, error } = await client
      .from("assistant_turns")
      .select("status, pending_confirmation")
      .eq("conversation_id", conversationId)
      .eq("user_id", userId)
      .neq("user_message_id", excludeMessageId)
      .order("created_at", { ascending: false })
      .limit(1);
    if (error !== null) {
      throw failure("read the previous turn", error);
    }
    const [previous] = data;
    if (previous === undefined) {
      return null;
    }
    const status = turnStatuses.find((candidate) => candidate === previous.status);
    if (status === undefined) {
      throw failure("read a turn status", null);
    }
    const pending = pendingToolSchema.safeParse(previous.pending_confirmation);
    return {
      status,
      pendingTool: pending.success ? pending.data.tool : null,
      pendingConfirmationId: pending.success ? (pending.data.id ?? null) : null,
      pendingConfirmLabel: pending.success ? (pending.data.confirm_label ?? null) : null,
    };
  }

  async function readConversationRow(userId: string, conversationId: string) {
    const { data, error } = await client
      .from("assistant_conversations")
      .select("compaction_summary, compacted_through_turn_id, updated_at")
      .eq("id", conversationId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error !== null) {
      throw failure("read the conversation", error);
    }
    return data;
  }

  // The columns are null together or set together (a check on the table), so one null means no note.
  function noteOf(
    row: { compaction_summary: string | null; compacted_through_turn_id: string | null } | null,
  ): ConversationNote | null {
    return row?.compaction_summary != null && row.compacted_through_turn_id != null
      ? { summary: row.compaction_summary, throughTurnId: row.compacted_through_turn_id }
      : null;
  }

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
      await refuseWhileBusy(userId, conversationId);
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
        await refuseWhenOlderTurnIsOpen(userId, conversationId, turn.id);
        await insertMessages(userId, conversationId, turn.id, [
          { id: userMessageId, role: "user", content: [{ type: "text", text }] },
        ]);
        await touchConversation(userId, conversationId);
      } catch (caught) {
        // No open turn is left behind, which is also how the losing side of a race ends. The result is not
        // checked: the original failure is the one to throw.
        await client
          .from("assistant_turns")
          .update({ status: "failed", finished_at: now().toISOString() })
          .eq("id", turn.id)
          .eq("user_id", userId);
        throw caught;
      }
      return { turnId: turn.id, userMessageId };
    },

    appendMessages: insertMessages,

    async setUserMessageContent(userId, messageId, content) {
      const { error } = await client
        .from("assistant_messages")
        .update({ content })
        .eq("id", messageId)
        .eq("user_id", userId);
      if (error !== null) {
        throw failure("replace the user message", error);
      }
    },

    async readConversation(userId, conversationId, { excludeMessageId }) {
      const messages = await readMessages(userId, conversationId, excludeMessageId);
      const previousTurn = await readPreviousTurn(userId, conversationId, excludeMessageId);
      const compaction = noteOf(await readConversationRow(userId, conversationId));
      return { messages, previousTurn, compaction };
    },

    async readCompactionState(userId, conversationId) {
      const row = await readConversationRow(userId, conversationId);
      if (row === null) {
        throw failure("find the conversation", null);
      }
      const { data, error } = await client
        .from("assistant_turns")
        .select("id")
        .eq("conversation_id", conversationId)
        .eq("user_id", userId)
        .eq("status", "open")
        .limit(1);
      if (error !== null) {
        throw failure("read open turns for compaction", error);
      }
      return { note: noteOf(row), updatedAt: row.updated_at, turnIsOpen: data.length > 0 };
    },

    async storeCompaction(userId, conversationId, { summary, throughTurnId, seenUpdatedAt }) {
      const { data, error } = await client
        .from("assistant_conversations")
        .update({
          compaction_summary: summary,
          compacted_through_turn_id: throughTurnId,
          updated_at: now().toISOString(),
        })
        .eq("id", conversationId)
        .eq("user_id", userId)
        .eq("updated_at", seenUpdatedAt)
        .select("id");
      if (error !== null) {
        throw failure("store the compaction", error);
      }
      return data.length > 0;
    },

    async readTimeZone(userId) {
      const { data, error } = await client
        .from("profiles")
        .select("timezone")
        .eq("id", userId)
        .maybeSingle();
      if (error !== null) {
        throw failure("read the time zone", error);
      }
      if (data === null) {
        throw failure("find the profile", null);
      }
      return data.timezone;
    },

    async finishTurn(userId, turnId, status) {
      const { data, error } = await client
        .from("assistant_turns")
        .update({ status, finished_at: now().toISOString() })
        .eq("id", turnId)
        .eq("user_id", userId)
        .eq("status", "open")
        .select("conversation_id")
        .maybeSingle();
      if (error !== null) {
        throw failure("finish a turn", error);
      }
      // No row back means an earlier ending won, and that ending already touched the conversation.
      if (data !== null) {
        await touchConversation(userId, data.conversation_id);
      }
    },

    async turnHasAction(turnId) {
      const { data, error } = await client
        .from("assistant_actions")
        .select("id")
        .eq("turn_id", turnId)
        .limit(1);
      if (error !== null) {
        throw failure("read the turn's actions", error);
      }
      return data.length > 0;
    },
  };
}
