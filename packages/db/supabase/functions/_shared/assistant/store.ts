// The executor's only door to `assistant_actions` and to the pending confirmation on `assistant_turns`,
// over the service client. Both tables are written by the service role only, so every query here is
// filtered by the verified user id as well as by the row id. A row holds ids and one diary date and
// never a health value (ADR 0003, Amendment 14), and a failure carries the operation and a Postgres
// error code and never the database message, which can quote a row.
//
// This file imports nothing from the Deno-only helpers, so the integration test can run the real store
// and the real slot loop against the local database under Node.
import { z } from "zod";

import type { SupabaseClient } from "@supabase/supabase-js";

// ADR 0006: at most ten write tool calls per turn. The table's check on `turn_seq` is the backstop.
export const maxWritesPerTurn = 10;

const uniqueViolation = "23505";
const checkViolation = "23514";

// What a write left behind. A single-row write sets `targetId`, a multi-row write `targetIds`, and a
// write that names a diary day sets `targetLocalDate` (`day_logs` has no id).
export type ActionTarget = {
  targetId?: string;
  targetIds?: string[];
  targetLocalDate?: string;
  targetUpdatedAt?: string;
};

const actionRowSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  conversation_id: z.string().nullable(),
  turn_id: z.string().nullable(),
  turn_seq: z.number(),
  tool: z.string(),
  target_table: z.string(),
  target_id: z.string().nullable(),
  target_ids: z.array(z.string()).nullable(),
  target_local_date: z.string().nullable(),
  target_updated_at: z.string().nullable(),
  undone_at: z.string().nullable(),
});

const actionColumns =
  "id, user_id, conversation_id, turn_id, turn_seq, tool, target_table, target_id, target_ids, target_local_date, target_updated_at, undone_at";

export type ActionRecord = {
  id: string;
  userId: string;
  conversationId: string | null;
  turnId: string | null;
  turnSeq: number;
  tool: string;
  targetTable: string;
  targetId: string | null;
  targetIds: string[] | null;
  targetLocalDate: string | null;
  targetUpdatedAt: string | null;
  undoneAt: string | null;
};

// What `assistant_turns.pending_confirmation` holds: an id, a tool name, a hash and the words of the confirm
// button ("Delete 2 entries", "Copy 3 entries", "Archive recipe", "Change target"). Those are fixed words and
// a count of rows, so no health value. The cancel button's words are not stored, because "Keep 2,140" holds a
// calorie figure.
export type PendingConfirmation = {
  id: string;
  tool: string;
  inputHash: string;
  confirmLabel: string;
};

// The confirmation as it is read back. A row written before the button's words were stored has none, and
// it can never be confirmed: the next call asks again.
export type StoredConfirmation = Omit<PendingConfirmation, "confirmLabel"> & {
  confirmLabel: string | null;
};

const pendingConfirmationSchema = z.object({
  id: z.string(),
  tool: z.string(),
  input_hash: z.string(),
  confirm_label: z.string().optional(),
});

export type PreviousPendingConfirmation = { turnId: string; confirmation: StoredConfirmation };

export type SlotRequest = {
  userId: string;
  conversationId: string;
  turnId: string;
  tool: string;
  targetTable: string;
};

export type SlotInsertResult =
  { outcome: "reserved"; actionId: string } | { outcome: "slot_taken" } | { outcome: "over_limit" };

export type ActionStore = {
  takenSlots(turnId: string): Promise<number[]>;
  insertReservation(request: SlotRequest & { turnSeq: number }): Promise<SlotInsertResult>;
  fillTarget(actionId: string, userId: string, target: ActionTarget): Promise<void>;
  release(actionId: string, userId: string): Promise<void>;
  findAction(actionId: string, userId: string): Promise<ActionRecord | null>;
  // True for the one caller that moved the action from not undone to undone.
  claimUndo(actionId: string, userId: string, undoneAt: string): Promise<boolean>;
  releaseUndoClaim(actionId: string, userId: string): Promise<void>;
  previousPendingConfirmation(
    conversationId: string,
    userId: string,
    currentTurnId: string,
  ): Promise<PreviousPendingConfirmation | null>;
  storePendingConfirmation(
    turnId: string,
    userId: string,
    confirmation: PendingConfirmation,
  ): Promise<void>;
  // True for the one caller that cleared the confirmation, so it is spent once.
  spendPendingConfirmation(
    turnId: string,
    userId: string,
    confirmationId: string,
  ): Promise<boolean>;
};

function failure(operation: string, error: { code?: string } | null): Error {
  return new Error(`assistant action store ${operation} failed ${error?.code ?? "unknown"}`);
}

export function createActionStore(client: SupabaseClient): ActionStore {
  return {
    async takenSlots(turnId) {
      const { data, error } = await client
        .from("assistant_actions")
        .select("turn_seq")
        .eq("turn_id", turnId);
      if (error !== null) {
        throw failure("read slots", error);
      }
      return z
        .array(z.object({ turn_seq: z.number() }))
        .parse(data)
        .map((row) => row.turn_seq);
    },

    async insertReservation(request) {
      const { data, error } = await client
        .from("assistant_actions")
        .insert({
          user_id: request.userId,
          conversation_id: request.conversationId,
          turn_id: request.turnId,
          turn_seq: request.turnSeq,
          tool: request.tool,
          target_table: request.targetTable,
        })
        .select("id")
        .single();
      if (error === null) {
        return { outcome: "reserved", actionId: z.object({ id: z.string() }).parse(data).id };
      }
      if (error.code === uniqueViolation) {
        return { outcome: "slot_taken" };
      }
      if (error.code === checkViolation) {
        return { outcome: "over_limit" };
      }
      throw failure("reserve", error);
    },

    async fillTarget(actionId, userId, target) {
      const { error } = await client
        .from("assistant_actions")
        .update({
          target_id: target.targetId ?? null,
          target_ids: target.targetIds ?? null,
          target_local_date: target.targetLocalDate ?? null,
          target_updated_at: target.targetUpdatedAt ?? null,
        })
        .eq("id", actionId)
        .eq("user_id", userId);
      if (error !== null) {
        throw failure("fill target", error);
      }
    },

    async release(actionId, userId) {
      const { error } = await client
        .from("assistant_actions")
        .delete()
        .eq("id", actionId)
        .eq("user_id", userId);
      if (error !== null) {
        throw failure("release", error);
      }
    },

    async findAction(actionId, userId) {
      const { data, error } = await client
        .from("assistant_actions")
        .select(actionColumns)
        .eq("id", actionId)
        .eq("user_id", userId)
        .maybeSingle();
      if (error !== null) {
        throw failure("find action", error);
      }
      if (data === null) {
        return null;
      }
      const row = actionRowSchema.parse(data);
      return {
        id: row.id,
        userId: row.user_id,
        conversationId: row.conversation_id,
        turnId: row.turn_id,
        turnSeq: row.turn_seq,
        tool: row.tool,
        targetTable: row.target_table,
        targetId: row.target_id,
        targetIds: row.target_ids,
        targetLocalDate: row.target_local_date,
        targetUpdatedAt: row.target_updated_at,
        undoneAt: row.undone_at,
      };
    },

    async claimUndo(actionId, userId, undoneAt) {
      const { data, error } = await client
        .from("assistant_actions")
        .update({ undone_at: undoneAt })
        .eq("id", actionId)
        .eq("user_id", userId)
        .is("undone_at", null)
        .select("id");
      if (error !== null) {
        throw failure("claim undo", error);
      }
      return Array.isArray(data) && data.length === 1;
    },

    async releaseUndoClaim(actionId, userId) {
      const { error } = await client
        .from("assistant_actions")
        .update({ undone_at: null })
        .eq("id", actionId)
        .eq("user_id", userId);
      if (error !== null) {
        throw failure("release undo", error);
      }
    },

    async previousPendingConfirmation(conversationId, userId, currentTurnId) {
      // The previous turn is the latest one made before the current turn, so an older open turn can
      // never see a confirmation that a later turn asked for.
      const current = await client
        .from("assistant_turns")
        .select("created_at")
        .eq("id", currentTurnId)
        .eq("conversation_id", conversationId)
        .eq("user_id", userId)
        .maybeSingle();
      if (current.error !== null) {
        throw failure("read current turn", current.error);
      }
      if (current.data === null) {
        return null;
      }
      const { created_at: currentCreatedAt } = z
        .object({ created_at: z.string() })
        .parse(current.data);
      const { data, error } = await client
        .from("assistant_turns")
        .select("id, pending_confirmation")
        .eq("conversation_id", conversationId)
        .eq("user_id", userId)
        .lt("created_at", currentCreatedAt)
        .order("created_at", { ascending: false })
        .limit(1);
      if (error !== null) {
        throw failure("read previous turn", error);
      }
      const [previous] = z
        .array(z.object({ id: z.string(), pending_confirmation: z.unknown() }))
        .parse(data);
      const parsed = pendingConfirmationSchema.safeParse(previous?.pending_confirmation);
      if (previous === undefined || !parsed.success) {
        return null;
      }
      const { id, tool, input_hash: inputHash, confirm_label: confirmLabel } = parsed.data;
      return {
        turnId: previous.id,
        confirmation: { id, tool, inputHash, confirmLabel: confirmLabel ?? null },
      };
    },

    async storePendingConfirmation(turnId, userId, confirmation) {
      const { error } = await client
        .from("assistant_turns")
        .update({
          pending_confirmation: {
            id: confirmation.id,
            tool: confirmation.tool,
            input_hash: confirmation.inputHash,
            confirm_label: confirmation.confirmLabel,
          },
        })
        .eq("id", turnId)
        .eq("user_id", userId);
      if (error !== null) {
        throw failure("store confirmation", error);
      }
    },

    async spendPendingConfirmation(turnId, userId, confirmationId) {
      const { data, error } = await client
        .from("assistant_turns")
        .update({ pending_confirmation: null })
        .eq("id", turnId)
        .eq("user_id", userId)
        .eq("pending_confirmation->>id", confirmationId)
        .select("id");
      if (error !== null) {
        throw failure("spend confirmation", error);
      }
      return Array.isArray(data) && data.length === 1;
    },
  };
}

export type SlotReservation =
  { outcome: "reserved"; actionId: string; turnSeq: number } | { outcome: "limit_reached" };

// Every attempt that loses a race means another call took the slot it wanted. With ten slots and
// releases, this many attempts is far beyond any real turn, so running out is a fault and not a limit.
const maxReservationAttempts = 25;

// Takes the lowest free slot of the turn. Reading the taken slots and inserting are two steps, so
// parallel calls can pick the same slot. The unique key lets one win and tells the others, who read
// again and take the next free slot. A released slot is free again. When all ten are taken the call
// is refused without an insert, and the table's check on `turn_seq` refuses an eleventh in any case.
export async function reserveNextSlot(
  store: Pick<ActionStore, "takenSlots" | "insertReservation">,
  request: SlotRequest,
): Promise<SlotReservation> {
  for (let attempt = 0; attempt < maxReservationAttempts; attempt += 1) {
    const taken = new Set(await store.takenSlots(request.turnId));
    let turnSeq = 1;
    while (taken.has(turnSeq)) {
      turnSeq += 1;
    }
    if (turnSeq > maxWritesPerTurn) {
      return { outcome: "limit_reached" };
    }
    const inserted = await store.insertReservation({ ...request, turnSeq });
    if (inserted.outcome === "reserved") {
      return { outcome: "reserved", actionId: inserted.actionId, turnSeq };
    }
    if (inserted.outcome === "over_limit") {
      return { outcome: "limit_reached" };
    }
  }
  throw new Error("assistant action store reserve did not settle");
}
