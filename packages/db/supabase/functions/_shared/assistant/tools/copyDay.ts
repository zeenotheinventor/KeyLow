// Copies the entries of one diary day onto another, as the Diary's Copy yesterday does, and nothing is
// replaced. Copying onto a day that already has entries asks first. The copy is one write whatever the
// number of entries, so it takes one slot and lists the new entries in `target_ids` and the day they
// went onto in `target_local_date` (ADR 0003, Amendment 14).
import { z } from "zod";

import { buildDayCopiedCard, cardEntryOfRow, localToday } from "../../core.ts";
import {
  CopyDayPartialWriteError,
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

// The copies are inserted one by one and then stamped together by one request that names every id, so a
// day with more entries than this is answered with `too_many_entries` and never copied.
const maxEntriesPerDay = 100;

const copyDayInput = z.strictObject({
  from: localDateSchema.describe("The day to copy from, YYYY-MM-DD."),
  to: localDateSchema.describe(
    "The day to copy onto, YYYY-MM-DD. When the person says today, use today's date from the context block.",
  ),
  entry_count: z
    .number()
    .int()
    .min(1)
    .describe(
      `How many entries the day you copy from has, counted from get_day, at most ${maxEntriesPerDay}. The user is shown this number, so it must be the day's own.`,
    ),
});

type CopyDayInput = z.infer<typeof copyDayInput>;

export const copyDayTool: WriteToolDefinition<CopyDayInput> = {
  name: "copy_day",
  description:
    "Copies every entry of one diary day onto another day, with Undo, and replaces nothing. Read the day " +
    "you copy from with get_day first, and pass the number of entries it has as entry_count. A day with " +
    `more than ${maxEntriesPerDay} entries cannot be copied. When the day you copy onto already has ` +
    "entries the call first answers needs_confirmation with a confirmation_id: ask the user in your own " +
    "words how many entries it has, how many you would add, and that nothing is replaced, and when they " +
    "say yes call again with the same input and that confirmation_id. To copy a single meal, use " +
    "get_entries and log_entry instead.",
  kind: "write",
  input: copyDayInput,
  annotations: { readOnlyHint: false, destructiveHint: false },
  targetTable: "food_log_entries",
  // Asks only for a copy that `run` would make: a refusal (the same day, a day that is not the number the
  // model counted, a day too large or empty) must not spend a confirmation or show a button for it.
  async needsConfirmation({ from, to, entry_count }, ctx) {
    if (to === from) {
      return false;
    }
    const source = await getDiaryDay(ctx.caller, from);
    if (source.entries.length !== entry_count || source.entries.length > maxEntriesPerDay) {
      return false;
    }
    const { entries } = await getDiaryDay(ctx.caller, to);
    return entries.length > 0;
  },
  async run(ctx, { from, to, entry_count }): Promise<WriteRunOutput> {
    if (to === from) {
      return invalidInput(["to"]);
    }
    const timeZone = zoneOrUtc(await getMyTimeZone(ctx.caller));
    const source = await getDiaryDay(ctx.caller, from);
    if (source.entries.length > maxEntriesPerDay) {
      return { data: { error: "too_many_entries", limit: maxEntriesPerDay }, target: null };
    }
    // The person was shown this number. A day that has other entries now is not what they agreed to.
    if (source.entries.length !== entry_count) {
      return invalidInput(["entry_count"]);
    }
    let entryIds: string[];
    let partlyCopied = false;
    try {
      entryIds = (await copyDay(ctx.caller, { from, to, timeZone })).entryIds;
    } catch (caught) {
      if (!(caught instanceof CopyDayPartialWriteError)) {
        throw caught;
      }
      // Some copies are in the day and could not be taken back. They get an action, so Undo can remove
      // them. The repo's message is not reported, because it can quote a row.
      ctx.reportError(
        "assistant tool copy_day",
        "internal_error",
        new Error("copy_day left a partial copy"),
      );
      entryIds = caught.entryIds;
      partlyCopied = true;
    }
    if (entryIds.length === 0) {
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
        .in("id", entryIds)
        .is("deleted_at", null);
      if (error) {
        // The database's message can quote a row, so only its code is kept.
        throw new Error(`Could not stamp the copies ${error.code}`);
      }
      const [stamp] = await readLogEntryStamps(ctx.caller, entryIds);
      targetUpdatedAt = stamp?.updatedAt;
    } catch (caught) {
      ctx.reportError("assistant tool copy_day", "internal_error", caught);
    }
    const target = {
      targetIds: entryIds,
      targetLocalDate: to,
      ...(targetUpdatedAt === undefined ? {} : { targetUpdatedAt }),
    };
    if (partlyCopied) {
      return { data: { error: "copy_incomplete", copied: entryIds.length }, target };
    }

    let cardEntries: CardEntry[] = [];
    try {
      const { entries } = await getDiaryDay(ctx.caller, to);
      cardEntries = entries
        .filter(({ id }) => entryIds.includes(id))
        .flatMap((entry) => {
          const cardEntry = cardEntryOfRow(entry, timeZone);
          return cardEntry === null ? [] : [cardEntry];
        });
    } catch (caught) {
      ctx.reportError("assistant tool copy_day", "internal_error", caught);
    }
    return {
      data: { copied: entryIds.length, from, to },
      structured: {
        card: buildDayCopiedCard({
          from,
          to,
          // The person's own today. The turn's day is the day their sheet is showing, which can be a past one.
          today: localToday(new Date().toISOString(), timeZone),
          count: entryIds.length,
          entries: cardEntries,
        }),
      },
      target,
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
