// The entries of a range of days, for "what did I eat for lunch yesterday?" and "log yesterday's lunch
// again". Each entry carries what a write needs to repeat it exactly (the food or recipe id, the
// portion id, the quantity and the unit), so nothing is logged from memory. A meal is not a thing the
// diary knows: "lunch" is a window of hours that the model chooses and says aloud.
import { z } from "zod";

import { addCalendarDays, describeRangeCitation, formatClockTime } from "../../core.ts";
import { getDiaryDay, getMyTimeZone } from "../../repos.ts";
import { citedResult, entryView, zoneOrUtc } from "./diaryView.ts";
import {
  clockTimeSchema,
  dataNotice,
  isRangeOfAtMost,
  localDateSchema,
  unknownNotice,
} from "./shared.ts";

import type { LogEntry } from "../../repos.ts";
import type { ReadToolDefinition } from "../tool.ts";

// A day is read with three queries, so a range is kept to a fortnight.
const maxEntryDays = 14;

const getEntriesInput = z
  .strictObject({
    from: localDateSchema.describe("The first day, YYYY-MM-DD, in the user's own time zone."),
    to: localDateSchema.describe(
      `The last day, YYYY-MM-DD, in the user's own time zone, at most ${maxEntryDays} days from the first.`,
    ),
    from_time: clockTimeSchema
      .nullable()
      .describe(
        "Only entries at or after this clock time of each day, in the user's own time zone, or null for no start.",
      ),
    to_time: clockTimeSchema
      .nullable()
      .describe(
        "Only entries at or before this clock time of each day, in the user's own time zone, or null for no end.",
      ),
  })
  .refine(isRangeOfAtMost(maxEntryDays), { path: ["to"] })
  // HH:MM is zero padded, so the times compare as text.
  .refine(
    ({ from_time, to_time }) => from_time === null || to_time === null || from_time <= to_time,
    {
      path: ["to_time"],
    },
  );

const daysOf = (from: string, to: string): string[] => {
  const days: string[] = [];
  for (let day = from; day <= to; day = addCalendarDays(day, 1)) {
    days.push(day);
  }
  return days;
};

// What a write takes to log the same thing again. A quick add has no food, no portion and no quantity.
const repeatFields = (entry: LogEntry) => ({
  item_type: entry.item_type,
  food_id: entry.food_id,
  recipe_id: entry.item_type === "recipe" ? entry.recipe_id : null,
  portion_id: entry.portion_id,
  quantity: entry.quantity,
  unit: entry.unit,
});

export const getEntriesTool: ReadToolDefinition<z.infer<typeof getEntriesInput>> = {
  name: "get_entries",
  description:
    `Lists the user's diary entries over a range of days, at most ${maxEntryDays}, both ends ` +
    "included, in date and time order. Each has its id, date, clock time, name and amount, its " +
    "kcal, protein, fat, carbs and fibre, and what a write needs to log the same thing again: " +
    "item_type, food_id or recipe_id, portion_id, quantity and unit. The diary has hours, not meals: " +
    "to find a meal such as lunch, choose a window of hours with from_time and to_time (each a " +
    "24-hour HH:MM, applied to every day of the range, or null for no limit) and say the window " +
    "aloud, for example lunch as 12:00 to 14:00. A window cannot cross midnight, so a late-night " +
    "window such as 22:00 to 02:00 needs two calls, one up to 23:59 and one from 00:00. The nutrients are already rounded as the Diary " +
    "rounds them. The citation is the line the app prints under your answer. " +
    `${unknownNotice} ${dataNotice}`,
  kind: "read",
  input: getEntriesInput,
  annotations: { readOnlyHint: true },
  async run(ctx, { from, to, from_time, to_time }) {
    const [days, timeZone] = await Promise.all([
      Promise.all(daysOf(from, to).map((day) => getDiaryDay(ctx.caller, day))),
      getMyTimeZone(ctx.caller),
    ]);
    const zone = zoneOrUtc(timeZone);
    const entries = days
      .flatMap((day) => day.entries)
      .flatMap((entry) => {
        const time = formatClockTime(new Date(entry.logged_at), zone);
        const isAfterStart = from_time === null || time >= from_time;
        const isBeforeEnd = to_time === null || time <= to_time;
        return isAfterStart && isBeforeEnd
          ? [{ date: entry.local_date, ...entryView(entry, zone), ...repeatFields(entry) }]
          : [];
      });

    return citedResult(
      { from, to, from_time, to_time, entry_count: entries.length, entries },
      describeRangeCitation({ from, to, entryCount: entries.length }),
    );
  },
};
