// Changes the amount or the time of one diary entry. The amount keeps the unit the entry was logged
// with, so the model gives a new count for a portion, or new grams, millilitres or servings, and the
// entry is worked out again from its own frozen snapshot. There is no Undo for an edit in M8, because
// `assistant_actions` holds no previous value to go back to (ADR 0006).
import { z } from "zod";

import { buildUpdatedCard, cardEntryOfRow, clockTimeOn } from "../../core.ts";
import { getLogEntry, getMyTimeZone, readLogEntryStamps, updateLogEntry } from "../../repos.ts";
import { zoneOrUtc } from "./diaryView.ts";
import { invalidInput, notFound } from "./entryWrite.ts";
import { clockTimeSchema } from "./shared.ts";

import type { EntryUpdate, LogEntry } from "../../repos.ts";
import type { WriteToolDefinition } from "../tool.ts";

const updateEntryInput = z
  .strictObject({
    id: z.guid().describe("The id of the entry, from get_day or get_entries."),
    amount: z
      .number()
      .positive()
      .max(5000)
      .nullable()
      .describe(
        "The new amount in the entry's own unit: a count for a portion, otherwise grams, millilitres or servings. Null to keep it.",
      ),
    time: clockTimeSchema
      .nullable()
      .describe("The new clock time on the entry's own day, or null to keep it."),
  })
  .refine(({ amount, time }) => amount !== null || time !== null, { path: ["amount"] });

const maxCount = 50;

type UpdateEntryInput = z.infer<typeof updateEntryInput>;

// The repo's update for this entry. A quick add has no amount of its own, so it takes the time only.
function updateFor(
  entry: LogEntry,
  amount: number | null,
  time: EntryUpdate["time"],
): EntryUpdate | null {
  switch (entry.item_type) {
    case "quick":
      return amount === null ? { entry, ...(time === undefined ? {} : { time }) } : null;
    case "recipe":
      return {
        entry,
        ...(amount === null ? {} : { amount: { quantity: amount, unit: entry.unit } }),
        ...(time === undefined ? {} : { time }),
      };
    case "food":
      return {
        entry,
        ...(amount === null ? {} : { amount: { quantity: amount, unit: entry.unit } }),
        ...(time === undefined ? {} : { time }),
      };
  }
}

export const updateEntryTool: WriteToolDefinition<UpdateEntryInput> = {
  name: "update_entry",
  description:
    "Changes the amount or the time of one diary entry. Take the id from get_day or get_entries. Give the " +
    "amount in the unit the entry has: a new count for a portion, or new grams, millilitres or servings. " +
    "Give a time, HH:MM, to move the entry within its day. Set what you are not changing to null. This " +
    "cannot be undone from the card, so tell the user they can change it again in the diary.",
  kind: "write",
  input: updateEntryInput,
  annotations: { readOnlyHint: false, destructiveHint: true },
  targetTable: "food_log_entries",
  async run(ctx, { id, amount, time }) {
    const timeZone = zoneOrUtc(await getMyTimeZone(ctx.caller));
    const entry = await getLogEntry(ctx.caller, id);
    if (entry === null) {
      return notFound;
    }
    const update = updateFor(
      entry,
      amount,
      time === null
        ? undefined
        : {
            loggedAt: clockTimeOn(entry.local_date, time, timeZone).loggedAt.toISOString(),
            timeZone,
          },
    );
    // A count or a number of servings is capped as `log_entry` caps it. Grams and millilitres are
    // capped by the schema.
    const isCount =
      entry.item_type !== "quick" && (entry.unit === "portion" || entry.unit === "serving");
    if (update === null || (isCount && amount !== null && amount > maxCount)) {
      return invalidInput(["amount"]);
    }
    let updated: LogEntry;
    try {
      updated = await updateLogEntry(ctx.caller, update);
    } catch (caught) {
      if (caught instanceof RangeError) {
        return invalidInput(["amount"]);
      }
      throw caught;
    }
    // The write has landed. Nothing below may throw.
    let targetUpdatedAt: string | undefined;
    try {
      const [stamp] = await readLogEntryStamps(ctx.caller, [id]);
      targetUpdatedAt = stamp?.updatedAt;
    } catch (caught) {
      ctx.reportError("assistant tool update_entry", "internal_error", caught);
    }
    const cardEntry = cardEntryOfRow(updated, timeZone);
    return {
      data: { updated: id },
      ...(cardEntry === null ? {} : { structured: { card: buildUpdatedCard([cardEntry]) } }),
      target: { targetId: id, ...(targetUpdatedAt === undefined ? {} : { targetUpdatedAt }) },
    };
  },
  // An edit keeps no previous value, so there is nothing to go back to.
  inverse: null,
};
