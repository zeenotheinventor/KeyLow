import { describe, expect, it } from "vitest";

import { LONDON } from "./fixtures";
import { dailyStreak, freezeEventsDue } from "../../../src/achievements/streaks";
import { addCalendarDays } from "../../../src/dates";

import type { StreakDay } from "../../../src/achievements/streaks";

const BUDGET_MILLISECONDS = 50;
const HISTORY_DAYS = 400;
const FIRST_DAY = "2025-01-06";

// A long-time user: every day completed in the evening, with a missed day in every 20.
// The days run through a British Summer Time start and end, so the zone work is not all one offset.
const history: StreakDay[] = Array.from({ length: HISTORY_DAYS }, (_, offset) => offset)
  .filter((offset) => offset % 20 !== 19)
  .map((offset) => {
    const localDate = addCalendarDays(FIRST_DAY, offset);
    return {
      localDate,
      isComplete: true,
      completedAt: `${localDate}T21:00:00Z`,
      entryCount: 3,
    };
  });
const today = addCalendarDays(FIRST_DAY, HISTORY_DAYS - 1);
const now = new Date(`${today}T22:00:00Z`);

describe("streak maths over a long history", () => {
  it("should run the daily streak over 400 days in under 50 ms", () => {
    dailyStreak([], [], today, now, LONDON);

    const started = Date.now();
    const result = dailyStreak(history, [], today, now, LONDON, { from: FIRST_DAY, to: today });
    const elapsed = Date.now() - started;

    expect(result.calendar).toHaveLength(HISTORY_DAYS);
    expect(result.longest).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(BUDGET_MILLISECONDS);
  });

  it("should time the zone lookup too, with completions the quick check cannot settle", () => {
    // In Pago Pago (UTC-11) 23:00 UTC is midday, so each completion sits in the window where the
    // cutoff has to be looked up in the zone.
    const lateHistory = history.map((day) => ({
      ...day,
      completedAt: `${day.localDate}T23:00:00Z`,
    }));
    const zone = "Pacific/Pago_Pago";
    dailyStreak([], [], today, now, zone);

    const started = Date.now();
    const result = dailyStreak(lateHistory, [], today, now, zone, { from: FIRST_DAY, to: today });
    const elapsed = Date.now() - started;

    expect(result.longest).toBeGreaterThan(1);
    expect(elapsed).toBeLessThan(BUDGET_MILLISECONDS);
  });

  it("should work out the freezes due over 400 days in under 50 ms", () => {
    const started = Date.now();
    const rows = freezeEventsDue({
      days: history,
      ledger: [],
      grants: [],
      trainingWeeks: [],
      weighInWeeks: [],
      today,
      now,
      zone: LONDON,
    });
    const elapsed = Date.now() - started;

    expect(rows.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(BUDGET_MILLISECONDS);
  });
});
