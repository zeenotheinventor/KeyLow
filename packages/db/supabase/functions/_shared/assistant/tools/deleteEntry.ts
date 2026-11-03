// Deletes diary entries on the user's word. The rows are kept with `deleted_at` set, so Undo can bring
// them back. More than one entry is asked about first, and the call is one write whatever the count, so
// it takes one slot and lists its ids in `target_ids`.
import { z } from "zod";

import { buildDeletedCard, cardEntryOfRow } from "../../core.ts";
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
import type { WriteToolDefinition } from "../tool.ts";

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

export const deleteEntryTool: WriteToolDefinition<DeleteEntryInput> = {
  name: "delete_entry",
  description:
    "Deletes diary entries by id, with Undo. Take the ids from get_day or get_entries, never from memory. " +
    "When there is more than one id the call first answers needs_confirmation with a confirmation_id: " +
    "ask the user to confirm in your own words, naming the entries and the time, and when they say yes " +
    "call again with the same ids and that confirmation_id. An id that is not the user's is skipped " +
    "and reported as not found.",
  kind: "write",
  input: deleteEntryInput,
  annotations: { readOnlyHint: false, destructiveHint: true },
  targetTable: "food_log_entries",
  needsConfirmation: ({ ids }) => ids.length > 1,
  async run(ctx, { ids }) {
    const timeZone = zoneOrUtc(await getMyTimeZone(ctx.caller));
    // The words of the card are read first, because a deleted entry can no longer be read as live.
    const found = await Promise.all(ids.map((id) => getLogEntry(ctx.caller, id)));
    const entries = found.flatMap((entry): CardEntry[] => {
      const cardEntry = entry === null ? null : cardEntryOfRow(entry, timeZone);
      return cardEntry === null ? [] : [cardEntry];
    });
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
