// Deletes diary entries on the user's word. The rows are kept with `deleted_at` set, so Undo can bring
// them back. More than one entry is asked about first, and the call is one write whatever the count, so
// it takes one slot and lists its ids in `target_ids`.
import { z } from "zod";

import {
  buildDeletedCard,
  cardEntryOfRow,
  confirmDeleteButtons,
  confirmDeleteDayWord,
  confirmDeleteQuestion,
  localToday,
} from "../../core.ts";
import {
  getLogEntry,
  getMyTimeZone,
  readLogEntryStamps,
  restoreLogEntry,
  softDeleteLogEntries,
} from "../../repos.ts";
import { zoneOrUtc } from "./diaryView.ts";
import { leftAsWritten, notFound, targetIdsOf } from "./entryWrite.ts";

import type { CardEntry } from "../../core.ts";
import type { ConfirmationNeed, ToolContext, WriteToolDefinition } from "../tool.ts";

const maxIdsPerCall = 10;

const deleteEntryInput = z.strictObject({
  ids: z
    .array(z.guid())
    .min(1)
    .max(maxIdsPerCall)
    .refine((ids) => new Set(ids).size === ids.length)
    .describe(
      `The ids of the entries to delete, 1 to ${maxIdsPerCall}, from get_day or get_entries.`,
    ),
});

type DeleteEntryInput = z.infer<typeof deleteEntryInput>;

// The entries of the ids that are the person's own, as the cards word them. An id the person cannot see is left out.
async function cardEntriesOf(
  ctx: ToolContext,
  ids: readonly string[],
  timeZone: string,
): Promise<CardEntry[]> {
  const found = await Promise.all(ids.map((id) => getLogEntry(ctx.caller, id)));
  return found.flatMap((entry): CardEntry[] => {
    const cardEntry = entry === null ? null : cardEntryOfRow(entry, timeZone);
    return cardEntry === null ? [] : [cardEntry];
  });
}

export const deleteEntryTool: WriteToolDefinition<DeleteEntryInput> = {
  name: "delete_entry",
  description:
    "Deletes diary entries by id, with Undo. Take the ids from get_day or get_entries, never from memory. " +
    "To delete several entries, pass all their ids in one call. When there is more than one id the call " +
    "first answers needs_confirmation with a confirmation_id: in the same response as the call, before it, " +
    "write the question in your own words, naming the entries and the time, and when they say yes call " +
    "again with the same ids and that confirmation_id. When they say no, do not call again. An id that " +
    "is not the user's is skipped and reported as not found.",
  kind: "write",
  input: deleteEntryInput,
  annotations: { readOnlyHint: false, destructiveHint: true },
  targetTable: "food_log_entries",
  // Asks about more than one entry, and only when `run` would find one to delete: with none of the ids the
  // person's own, the call answers not found and no question or button is shown.
  async needsConfirmation({ ids }, ctx): Promise<ConfirmationNeed> {
    if (ids.length < 2) {
      return false;
    }
    const timeZone = zoneOrUtc(await getMyTimeZone(ctx.caller));
    const entries = await cardEntriesOf(ctx, ids, timeZone);
    if (entries.length === 0) {
      return false;
    }
    const today = localToday(new Date().toISOString(), timeZone);
    const dayWord = confirmDeleteDayWord(
      entries.map(({ entry }) => entry.local_date),
      today,
    );
    return {
      question: confirmDeleteQuestion(entries, dayWord),
      confirmLabel: confirmDeleteButtons(ids.length).confirmLabel,
    };
  },
  async run(ctx, { ids }) {
    const timeZone = zoneOrUtc(await getMyTimeZone(ctx.caller));
    // The words of the card are read first, because a deleted entry can no longer be read as live.
    const entries = await cardEntriesOf(ctx, ids, timeZone);
    const stamps = await softDeleteLogEntries(
      ctx.caller,
      entries.map(({ id }) => id),
    );
    const [first] = stamps;
    if (first === undefined) {
      return notFound;
    }
    const deletedIds = stamps.map(({ id }) => id);
    const deleted = entries.filter(({ id }) => deletedIds.includes(id));
    // One statement deleted them all, so the database gave every row the one stamp.
    const target =
      deletedIds.length === 1
        ? { targetId: first.id, targetUpdatedAt: first.updatedAt }
        : { targetIds: deletedIds, targetUpdatedAt: first.updatedAt };
    return {
      data: {
        deleted: deletedIds.length,
        not_found: ids.filter((id) => !deletedIds.includes(id)),
      },
      structured: { card: buildDeletedCard(deleted) },
      target,
    };
  },
  // Brings the entries back, unless the person has restored or changed any of them since.
  async inverse(ctx, action) {
    const ids = targetIdsOf(action);
    const states = await readLogEntryStamps(ctx.caller, ids);
    if (!leftAsWritten(states, action, { count: ids.length, deleted: true })) {
      return "unavailable";
    }
    await Promise.all(ids.map((id) => restoreLogEntry(ctx.caller, id)));
    return "undone";
  },
};
