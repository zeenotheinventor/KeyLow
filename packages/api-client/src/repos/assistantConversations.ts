import { assistantChangeCardsOfDisplay, isTrainingWriteTool } from "@keylow/core";
import { formatClockTime, isValidTimeZone } from "@keylow/core/dates";
import { z } from "zod";

import { invokeEdgeFunction } from "../edge";
import { ENTRY_COLUMNS } from "./diaryRows";
import { repoError } from "./repoError";
import { getMyTimeZone } from "./targets";

import type { Database } from "../database.types";
import type {
  AssistantChangeAction,
  AssistantChangeStoredCard,
  AssistantChangeTarget,
  AssistantStoredMessage,
} from "@keylow/core";
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

// Messages, replies and the rows an action changed are health data. A failure names the action and a
// database code only: the database's own message can quote a value, so it is never put in a message or a
// cause.
const messageRowSchema = z.object({
  id: z.string(),
  turn_id: z.string(),
  role: z.enum(["user", "assistant"]),
  content: z.unknown(),
  display: z.unknown(),
});

/** The API returns at most this many rows to a request, so a long list is read a page at a time. */
const PAGE_SIZE = 1000;

/** The most ids handed to a target source in one call, which keeps a request's URL short. */
const TARGET_CHUNK_SIZE = 100;

type Page<Row> = PromiseLike<{ data: Row[] | null; error: PostgrestError | null }>;

/**
 * Joins pages of `page(from, to)` until one comes back short. The query must have a total order. A row
 * written while the pages are read can move a row across a page edge and show it twice, so a row is kept
 * once, by its id.
 */
async function readAllRows<Row extends { id: string }>(
  action: string,
  page: (from: number, to: number) => Page<Row>,
): Promise<Row[]> {
  const rows: Row[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await page(offset, offset + PAGE_SIZE - 1);
    if (error) {
      throw repoError(action, error);
    }
    const pageRows = data ?? [];
    rows.push(...pageRows);
    if (pageRows.length < PAGE_SIZE) {
      return [...new Map(rows.map((row) => [row.id, row])).values()];
    }
  }
}

const chunksOf = <Item>(items: readonly Item[], size: number): Item[][] =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, (index + 1) * size),
  );

const turnRowSchema = z.object({
  id: z.string(),
  status: z.enum(["open", "complete", "clarify", "confirm", "stopped", "failed", "refused"]),
});

const actionColumns =
  "id, turn_id, turn_seq, tool, target_table, target_id, target_ids, target_local_date, target_updated_at, created_at, undone_at";

type ActionRow = Pick<
  Database["public"]["Tables"]["assistant_actions"]["Row"],
  | "id"
  | "turn_id"
  | "turn_seq"
  | "tool"
  | "target_table"
  | "target_id"
  | "target_ids"
  | "target_local_date"
  | "target_updated_at"
  | "created_at"
  | "undone_at"
>;

/** A row an action changed, as read back under the person's own JWT. */
export type AssistantTargetRead = {
  id: string;
  /** The row's change time as a write ticket defines it for the table, or null if it has none yet. */
  updatedAt: string | null;
  row: Record<string, unknown>;
};

/** Reads the rows of one target table by id, as the person. Rows that no longer exist are left out. */
export type AssistantTargetSource = (
  client: SupabaseClient<Database>,
  ids: string[],
) => Promise<AssistantTargetRead[]>;

const loggedEntryRowSchema = z.looseObject({
  id: z.string(),
  logged_at: z.iso.datetime({ offset: true }),
  updated_at: z.string(),
});

/**
 * Reads diary entries by id, deleted ones too, because the row of an undone log is a deleted entry. The
 * change time is `updated_at`, which the database stamps on every update (ADR 0003, Amendment 14,
 * addendum of 2026-11-03). Each row also carries `clock_time`, the entry's time on the person's own clock,
 * which the words of the cards and the changes list print.
 */
const readLoggedEntries: AssistantTargetSource = async (client, ids) => {
  const [entries, timeZone] = await Promise.all([
    client.from("food_log_entries").select(`${ENTRY_COLUMNS},updated_at`).in("id", ids),
    getMyTimeZone(client),
  ]);
  if (entries.error) {
    throw repoError("load what the assistant changed", entries.error);
  }
  const zone = timeZone !== null && isValidTimeZone(timeZone) ? timeZone : "UTC";
  return entries.data.map((entry) => {
    const row = loggedEntryRowSchema.parse(entry);
    return {
      id: row.id,
      updatedAt: row.updated_at,
      row: { ...row, clock_time: formatClockTime(new Date(row.logged_at), zone) },
    };
  });
};

/**
 * Reads recipes by id, archived ones too, because the row of an undone create is an archived recipe. A
 * recipe has no change time (ADR 0003 gives no table an `updated_at` but the diary), so `updatedAt` is null
 * and the app counts only a missing recipe as a change. The row carries what the words of the changes list
 * print: the name and the servings.
 */
const readRecipes: AssistantTargetSource = async (client, ids) => {
  const { data, error } = await client
    .from("recipes")
    .select("id,name,servings,is_archived")
    .in("id", ids);
  if (error) {
    throw repoError("load what the assistant changed", error);
  }
  return data.map((recipe) => ({ id: recipe.id, updatedAt: null, row: recipe }));
};

/**
 * Reads the caller's own foods by id, leaving out a deleted one, because a food the person has deleted
 * since is a change and its Undo is gone. A food has no change time (ADR 0003 gives no table an
 * `updated_at` but the diary), so `updatedAt` is null and only a missing food counts as a change. The row
 * carries the name the words of the changes list print.
 */
const readFoods: AssistantTargetSource = async (client, ids) => {
  const { data, error } = await client
    .from("foods")
    .select("id,name")
    .in("id", ids)
    .is("deleted_at", null);
  if (error) {
    throw repoError("load what the assistant changed", error);
  }
  return data.map((food) => ({ id: food.id, updatedAt: null, row: food }));
};

/**
 * Reads programs by id, ended ones too, because the program an Undo reopens was ended by the write. The
 * change time is `updated_at`, which the client writes on every update, so a program that was reopened or
 * edited since is a change. The row carries the id only: the plan is health data the words do not need.
 */
const readPrograms: AssistantTargetSource = async (client, ids) => {
  const { data, error } = await client.from("programs").select("id,updated_at").in("id", ids);
  if (error) {
    throw repoError("load what the assistant changed", error);
  }
  return data.map((program) => ({
    id: program.id,
    updatedAt: program.updated_at,
    row: { id: program.id },
  }));
};

/**
 * The target tables whose rows are read back, keyed by `assistant_actions.target_table`. A write ticket
 * (KEY-688, 693, 694, 697) adds its table here with the change time its inverse compares, and its card
 * words read the rows. A source gets at most 100 ids per call and parses each `row` with its own schema.
 * A table with no source here gives its actions no change check, so Undo stays
 * offered until the inverse itself answers `undo_unavailable`.
 */
export const assistantTargetSources: ReadonlyMap<string, AssistantTargetSource> = new Map([
  ["food_log_entries", readLoggedEntries],
  ["recipes", readRecipes],
  ["foods", readFoods],
  ["programs", readPrograms],
]);

export type AssistantActionsRead = {
  actions: AssistantChangeAction[];
  targets: AssistantChangeTarget[];
  /** The words of the training cards stored with the actions' turns, and nothing else the turns hold. Empty unless asked for. */
  cards: AssistantChangeStoredCard[];
};

const targetIdsOf = (row: ActionRow): string[] => [
  ...(row.target_id === null ? [] : [row.target_id]),
  ...(row.target_ids ?? []),
];

async function readTargetsByTable(
  client: SupabaseClient<Database>,
  rows: readonly ActionRow[],
  sources: ReadonlyMap<string, AssistantTargetSource>,
): Promise<Map<string, Map<string, AssistantTargetRead>>> {
  const idsByTable = new Map<string, Set<string>>();
  for (const row of rows) {
    if (sources.has(row.target_table)) {
      const ids = idsByTable.get(row.target_table) ?? new Set<string>();
      targetIdsOf(row).forEach((id) => ids.add(id));
      idsByTable.set(row.target_table, ids);
    }
  }
  const reads = await Promise.all(
    [...idsByTable].map(async ([table, ids]) => {
      const source = sources.get(table);
      const chunks = source === undefined ? [] : chunksOf([...ids], TARGET_CHUNK_SIZE);
      const chunkReads = await Promise.all(
        chunks.map((chunk) => source?.(client, chunk) ?? Promise.resolve([])),
      );
      return [table, new Map(chunkReads.flat().map((target) => [target.id, target]))] as const;
    }),
  );
  return new Map(reads);
}

/**
 * The training cards the turns of `rows` stored, for the changes list, which has no card for a training
 * write in the action row. One select reads the messages of the turns of the training writes (at most 100
 * turns to a request, to keep its URL short, and a person's own, since row level security shows no one
 * else's). Only `turn_id` and `display` are read, `display` is parsed here for the words of its cards, and
 * the rest of it is dropped on the spot: it also holds the value an Undo puts back, which must never reach
 * the query cache or a log. A turn that is gone, with its conversation, has no card.
 */
async function readStoredCards(
  client: SupabaseClient<Database>,
  rows: readonly ActionRow[],
): Promise<AssistantChangeStoredCard[]> {
  const turnIds = new Set(
    rows.flatMap((row) =>
      row.turn_id !== null && isTrainingWriteTool(row.tool) ? [row.turn_id] : [],
    ),
  );
  const reads = await Promise.all(
    chunksOf([...turnIds], TARGET_CHUNK_SIZE).map((chunk) =>
      readAllRows("load what the assistant changed", (from, to) =>
        client
          .from("assistant_messages")
          .select("id, display")
          .in("turn_id", chunk)
          .not("display", "is", null)
          .order("id", { ascending: true })
          .range(from, to),
      ),
    ),
  );
  return reads.flat().flatMap((message) => assistantChangeCardsOfDisplay(message.display));
}

/**
 * The caller's `assistant_actions`, newest first, with what their target rows read now. Row level security
 * shows a person their own rows. `conversationId` limits the read to one conversation's actions.
 * `withCards` also reads the training cards of the actions' turns, which only the changes list words from.
 */
export async function readAssistantActions(
  client: SupabaseClient<Database>,
  { conversationId, withCards = false }: { conversationId?: string; withCards?: boolean } = {},
  sources: ReadonlyMap<string, AssistantTargetSource> = assistantTargetSources,
): Promise<AssistantActionsRead> {
  const data = await readAllRows("load what the assistant changed", (from, to) => {
    const query = client.from("assistant_actions").select(actionColumns);
    return (conversationId === undefined ? query : query.eq("conversation_id", conversationId))
      .order("created_at", { ascending: false })
      .order("turn_seq", { ascending: false })
      .order("id", { ascending: false })
      .range(from, to);
  });

  const [targetsByTable, cards] = await Promise.all([
    readTargetsByTable(client, data, sources),
    withCards ? readStoredCards(client, data) : Promise.resolve([]),
  ]);
  const actions = data.map((row): AssistantChangeAction => {
    const ids = targetIdsOf(row);
    const read = targetsByTable.get(row.target_table);
    return {
      id: row.id,
      turnId: row.turn_id,
      tool: row.tool,
      turnSeq: row.turn_seq,
      hasTarget: ids.length > 0 || row.target_local_date !== null,
      createdAt: row.created_at,
      undoneAt: row.undone_at,
      targetUpdatedAt: row.target_updated_at,
      targetIds: ids,
      targets:
        read === undefined || ids.length === 0
          ? null
          : ids.map((id) => {
              const target = read.get(id);
              return { found: target !== undefined, updatedAt: target?.updatedAt ?? null };
            }),
    };
  });
  const targets = data.flatMap((row) =>
    targetIdsOf(row).map((id): AssistantChangeTarget => {
      const target = targetsByTable.get(row.target_table)?.get(id);
      return { id, row: target?.row ?? null };
    }),
  );
  return { actions, targets, cards };
}

export type AssistantConversationRead = {
  conversationId: string;
  messages: AssistantStoredMessage[];
  actions: AssistantChangeAction[];
};

/**
 * The newest conversation of the caller by `updated_at` (the function bumps it on every turn), its
 * messages in `seq` order with the status of each message's turn, and its actions. Null when the caller
 * has no conversation.
 */
export async function getLatestAssistantConversation(
  client: SupabaseClient<Database>,
): Promise<AssistantConversationRead | null> {
  const newest = await client
    .from("assistant_conversations")
    .select("id")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (newest.error) {
    throw repoError("load your conversation", newest.error);
  }
  if (newest.data === null) {
    return null;
  }
  const conversationId = newest.data.id;

  const [messages, turns, actions] = await Promise.all([
    readAllRows("load your conversation", (from, to) =>
      client
        .from("assistant_messages")
        .select("id, turn_id, role, content, display")
        .eq("conversation_id", conversationId)
        .order("seq", { ascending: true })
        .range(from, to),
    ),
    readAllRows("load your conversation", (from, to) =>
      client
        .from("assistant_turns")
        .select("id, status")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to),
    ),
    readAssistantActions(client, { conversationId }),
  ]);

  const statusOfTurn = new Map(
    turns.map((turn) => {
      const parsed = turnRowSchema.parse(turn);
      return [parsed.id, parsed.status] as const;
    }),
  );
  return {
    conversationId,
    messages: messages.map((row) => {
      const message = messageRowSchema.parse(row);
      // The three reads are not one snapshot. A turn that starts after the turns were read has a message
      // here and no status, and it is a live turn, so it reads as open. Paging means a status is never
      // missing because the list was cut short.
      const turnStatus = statusOfTurn.get(message.turn_id) ?? "open";
      return {
        id: message.id,
        turnId: message.turn_id,
        role: message.role,
        content: message.content,
        display: message.display,
        turnStatus,
      };
    }),
    actions: actions.actions,
  };
}

// The same shape as the id of the contract, which core's entry point does not export.
const newConversationSchema = z.object({ conversationId: z.guid() });

/** Starts an empty conversation through the `assistant` function, which becomes the newest. */
export async function createAssistantConversation(
  client: SupabaseClient<Database>,
): Promise<string> {
  const answer = await invokeEdgeFunction<unknown>(client, "assistant/conversations");
  return newConversationSchema.parse(answer).conversationId;
}

/**
 * Deletes every conversation of the caller. Row level security allows the owner's delete only, so no
 * owner filter is needed, and the filter below only keeps PostgREST from refusing a delete with none.
 * The turns and messages go with them by the cascade, and the actions stay with no conversation.
 */
export async function deleteAllAssistantConversations(
  client: SupabaseClient<Database>,
): Promise<void> {
  const { error } = await client.from("assistant_conversations").delete().not("id", "is", null);
  if (error) {
    throw repoError("delete your conversations", error);
  }
}

const undoAnswerSchema = z.object({
  results: z.array(
    z.object({
      actionId: z.guid(),
      result: z.enum(["undone", "already_undone", "undo_unavailable", "not_found"]),
      // Why an Undo was refused. A reason this app does not know is read as none, so a server that is ahead never fails an Undo.
      reason: z
        .enum(["changed", "active", "logged", "used", "workout_in_progress"])
        .optional()
        .catch(undefined),
    }),
  ),
});

export type AssistantUndoResult = z.infer<typeof undoAnswerSchema>["results"][number];

/** Undoes the actions of a card through the `assistant` function, which answers one code per id. */
export async function undoAssistantActions(
  client: SupabaseClient<Database>,
  actionIds: readonly string[],
): Promise<AssistantUndoResult[]> {
  const answer = await invokeEdgeFunction<unknown>(client, "assistant/undo", { actionIds });
  return undoAnswerSchema.parse(answer).results;
}
