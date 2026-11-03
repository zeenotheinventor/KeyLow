// Copies the entries of one diary day onto another, as the Diary's Copy yesterday does, and nothing is
// replaced. Copying onto a day that already has entries asks first. The copy is one write whatever the
// number of entries, so it takes one slot and lists the new entries in `target_ids` and the day they
// went onto in `target_local_date` (ADR 0003, Amendment 14).
import { z } from "zod";

import { buildDayCopiedCard, cardEntryOfRow } from "../../core.ts";
import {
  copyDay,
  getDiaryDay,
  getMyTimeZone,
  readLogEntryStamps,
  undoCopyDay,
} from "../../repos.ts";
import { zoneOrUtc } from "./diaryView.ts";
import { invalidInput, leftAsWritten, targetIdsOf } from "./entryWrite.ts";
import { localDateSchema } from "./shared.ts";

import type { CardEntry } from "../../core.ts";
import type { WriteRunOutput, WriteToolDefinition } from "../tool.ts";

// A day's entries travel in one request when the copies are given a shared stamp, so a day is capped.
const maxEntriesPerDay = 100;

const copyDayInput = z.strictObject({
  from: localDateSchema.describe("The day to copy from, YYYY-MM-DD."),
  to: localDateSchema
    .nullable()
    .describe(
      "The day to copy onto, YYYY-MM-DD, or null for the day the user's sheet was opened on.",
    ),
  entry_count: z
    .number()
    .int()
    .min(1)
    .max(maxEntriesPerDay)
    .describe(
      "How many entries the day you copy from has, counted from get_day. The user is shown this number, so it must be the day's own.",
    ),
});

type CopyDayInput = z.infer<typeof copyDayInput>;

export const copyDayTool: WriteToolDefinition<CopyDayInput> = {
  name: "copy_day",
  description:
    "Copies every entry of one diary day onto another day, with Undo, and replaces nothing. Read the day " +
    "you copy from with get_day first, and pass the number of entries it has as entry_count. Set to to " +
    "null to copy onto the day the user's sheet was opened on, which is today for 'copy yesterday to " +
    "today'. When the day you copy onto already has entries the call first answers needs_confirmation " +
    "with a confirmation_id: ask the user in your own words how many entries it has, how many you would " +
    "add, and that nothing is replaced, and when they say yes call again with the same input and that " +
    "confirmation_id. To copy a single meal, use get_entries and log_entry instead.",
  kind: "write",
  input: copyDayInput,
  annotations: { readOnlyHint: false, destructiveHint: false },
  targetTable: "food_log_entries",
  async needsConfirmation({ from, to }, ctx) {
    const onto = to ?? ctx.turn.localDate;
    if (onto === from) {
      return false;
    }
    const { entries } = await getDiaryDay(ctx.caller, onto);
    return entries.length > 0;
  },
  async run(ctx, { from, to, entry_count }): Promise<WriteRunOutput> {
    const onto = to ?? ctx.turn.localDate;
    if (onto === from) {
      return invalidInput(["to"]);
    }
    const timeZone = zoneOrUtc(await getMyTimeZone(ctx.caller));
    const source = await getDiaryDay(ctx.caller, from);
    // The person was shown this number. A day that has other entries now is not what they agreed to.
    if (source.entries.length !== entry_count) {
      return invalidInput(["entry_count"]);
    }
    const copied = await copyDay(ctx.caller, { from, to: onto, timeZone });
    if (copied.count === 0) {
      return { data: { copied: 0 }, target: null };
    }

    // The write has landed. Nothing below may throw.
    // Each copy was inserted by its own request, so each has its own stamp. One update over all of them
    // gives them the one stamp that the card and Undo compare, as a multi-row delete has.
    let targetUpdatedAt: string | undefined;
    try {
      const { error } = await ctx.caller
        .from("food_log_entries")
        .update({ deleted_at: null })
        .in("id", copied.entryIds)
        .is("deleted_at", null);
      if (error) {
        // The database's message can quote a row, so only its code is kept.
        throw new Error(`Could not stamp the copies ${error.code}`);
      }
      const [stamp] = await readLogEntryStamps(ctx.caller, copied.entryIds);
      targetUpdatedAt = stamp?.updatedAt;
    } catch (caught) {
      ctx.reportError("assistant tool copy_day", "internal_error", caught);
    }
    let cardEntries: CardEntry[] = [];
    try {
      const { entries } = await getDiaryDay(ctx.caller, onto);
      cardEntries = entries
        .filter(({ id }) => copied.entryIds.includes(id))
        .flatMap((entry) => {
          const cardEntry = cardEntryOfRow(entry, timeZone);
          return cardEntry === null ? [] : [cardEntry];
        });
    } catch (caught) {
      ctx.reportError("assistant tool copy_day", "internal_error", caught);
    }
    return {
      data: { copied: copied.count, from, to: onto },
      ...(cardEntries.length === 0
        ? {}
        : {
            structured: {
              card: buildDayCopiedCard({
                from,
                to: onto,
                today: ctx.turn.localDate,
                entries: cardEntries,
              }),
            },
          }),
      target: {
        targetIds: copied.entryIds,
        targetLocalDate: onto,
        ...(targetUpdatedAt === undefined ? {} : { targetUpdatedAt }),
      },
    };
  },
  // Removes the copies, unless the person has changed or removed any of them since.
  async inverse(ctx, action) {
    const ids = targetIdsOf(action);
    if (action.targetLocalDate === null) {
      return "unavailable";
    }
    const states = await readLogEntryStamps(ctx.caller, ids);
    if (!leftAsWritten(states, action, { count: ids.length, deleted: false })) {
      return "unavailable";
    }
    await undoCopyDay(ctx.caller, {
      localDate: action.targetLocalDate,
      count: ids.length,
      entryIds: ids,
    });
    return "undone";
  },
};
