// One day of the diary, for "what did I eat yesterday?" and "what's left for today?". The sums are
// worked out here from the nutrients each entry froze when it was logged, never from the food row,
// and the citation line is built here, so the model only phrases what it is given.
import { z } from "zod";

import { describeDayCitation, localToday, sumEntries } from "../../core.ts";
import { getDiaryDay, getMyTargets, getMyTimeZone } from "../../repos.ts";
import {
  citedResult,
  entryView,
  leftView,
  noNutrientsEaten,
  nutrientsView,
  targetsOfDay,
  targetsView,
  zoneOrUtc,
} from "./diaryView.ts";
import { dataNotice, localDateSchema, unknownNotice } from "./shared.ts";

import type { ReadToolDefinition } from "../tool.ts";

const getDayInput = z.strictObject({ local_date: localDateSchema });

export const getDayTool: ReadToolDefinition<z.infer<typeof getDayInput>> = {
  name: "get_day",
  description:
    "Reads one day of the user's diary: its entries by time, each with its id, name, amount, clock " +
    "time and kcal, protein, fat, carbs and fibre, then the day's totals, the user's targets for that " +
    "day and what is left of each (negative means over). The targets are the user's current targets, " +
    "applied to past days as well. The sums are worked out here from what each " +
    "entry was logged with, already rounded as the Diary rounds them, so use them as given and do " +
    "not add anything up. The citation is the line the app prints under your answer. " +
    `${unknownNotice} A null target means none is set. ${dataNotice}`,
  kind: "read",
  input: getDayInput,
  annotations: { readOnlyHint: true },
  async run(ctx, { local_date }) {
    const [day, targets, timeZone] = await Promise.all([
      getDiaryDay(ctx.caller, local_date),
      getMyTargets(ctx.caller),
      getMyTimeZone(ctx.caller),
    ]);
    const zone = zoneOrUtc(timeZone);
    // The day's total, from the entries' own frozen nutrients. A day with nothing in it ate nothing.
    const eaten = day.entries.length === 0 ? noNutrientsEaten : sumEntries(day.entries);
    const dayTargets = targetsOfDay(targets, local_date);

    return citedResult(
      {
        local_date,
        entry_count: day.entries.length,
        entries: day.entries.map((entry) => entryView(entry, zone)),
        totals: nutrientsView(eaten),
        targets: targetsView(dayTargets),
        left: leftView(dayTargets, eaten),
      },
      describeDayCitation({
        localDate: local_date,
        today: localToday(new Date().toISOString(), zone),
        entryCount: day.entries.length,
      }),
    );
  },
};
