import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { benchPress, heatSet, repeat } from "./heatSets";
import { TRAINING_REMINDER_TYPES } from "../../src/copy";
import { addCalendarDays, instantAtLocalTime, toLocalDate } from "../../src/dates";
import { planTrainingReminders } from "../../src/training";

import type { TrainingReminderInput } from "../../src/training";

// Zones with and without clock changes inside the seven days, far apart from UTC both ways.
const ZONES = ["Europe/London", "America/Los_Angeles", "Pacific/Auckland", "Asia/Kolkata", "UTC"];
// From mid 2026 to the end of 2027, which takes in every change of clocks of the zones above.
const FIRST_NOW = Date.UTC(2026, 5, 1);
const LAST_NOW = Date.UTC(2027, 11, 31);
const MILLISECONDS_PER_DAY = 86_400_000;

const everyVariantId = TRAINING_REMINDER_TYPES.flatMap((type) =>
  Array.from({ length: type === "train" ? 8 : 6 }, (_, index) => `${type}-${index + 1}`),
);
const lastDelivered = fc.record({
  train: fc.option(fc.constantFrom(...everyVariantId.filter((id) => id.startsWith("train"))), {
    nil: null,
  }),
  progress: fc.option(
    fc.constantFrom(...everyVariantId.filter((id) => id.startsWith("progress"))),
    {
      nil: null,
    },
  ),
  ease: fc.option(fc.constantFrom(...everyVariantId.filter((id) => id.startsWith("ease"))), {
    nil: null,
  }),
});

const chest = [{ muscle_id: "chest_lower", role: "primary" }] as const;

const reminderInput: fc.Arbitrary<TrainingReminderInput> = fc
  .record({
    now: fc
      .integer({ min: FIRST_NOW, max: LAST_NOW })
      .map((milliseconds) => new Date(milliseconds).toISOString()),
    timeZone: fc.constantFrom(...ZONES),
    settings: fc.record({
      trainEnabled: fc.boolean(),
      progressEnabled: fc.boolean(),
      easeEnabled: fc.boolean(),
      trainTime: fc
        .tuple(fc.integer({ min: 0, max: 23 }), fc.integer({ min: 0, max: 59 }))
        .map(
          ([hour, minute]) => `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
        ),
    }),
    weekdays: fc.uniqueArray(fc.integer({ min: 0, max: 6 }), { maxLength: 7 }),
    hasRoutine: fc.boolean(),
    weeklyGain: fc.boolean(),
    lastVariantIds: lastDelivered,
    setCount: fc.integer({ min: 0, max: 30 }),
    hoursBeforeNow: fc.integer({ min: 0, max: 36 }),
    sessionDaysAgo: fc.array(fc.integer({ min: -1, max: 7 }), { maxLength: 4 }),
  })
  .map(
    ({
      weekdays,
      hasRoutine,
      setCount,
      hoursBeforeNow,
      sessionDaysAgo,
      now,
      timeZone,
      ...rest
    }) => {
      const nowMilliseconds = Date.parse(now);
      const today = toLocalDate(new Date(nowMilliseconds), timeZone);
      return {
        ...rest,
        now,
        timeZone,
        plan: hasRoutine
          ? { days: weekdays.map((weekday) => ({ weekday, exercises: [{ muscles: chest }] })) }
          : null,
        heatSets: repeat(
          setCount,
          heatSet(benchPress, {
            performed_at: new Date(nowMilliseconds - hoursBeforeNow * 3_600_000).toISOString(),
          }),
        ),
        sessions: sessionDaysAgo.map((offset) => ({
          local_date: addCalendarDays(today, offset),
          ended_at: now,
          deleted_at: null,
        })),
      };
    },
  );

describe("planTrainingReminders properties", () => {
  it("should fire every reminder after now and before the end of the seventh local day", () => {
    fc.assert(
      fc.property(reminderInput, (input) => {
        const today = toLocalDate(new Date(input.now), input.timeZone);
        const endOfWindow = instantAtLocalTime(addCalendarDays(today, 7), 0, 0, input.timeZone);

        for (const { fireAt } of planTrainingReminders(input)) {
          expect(Date.parse(fireAt)).toBeGreaterThan(Date.parse(input.now));
          expect(Date.parse(fireAt)).toBeLessThan(endOfWindow.getTime());
          // Never more than seven days and an hour ahead, the hour being a clock change.
          expect(Date.parse(fireAt) - Date.parse(input.now)).toBeLessThanOrEqual(
            7 * MILLISECONDS_PER_DAY + 3_600_000,
          );
        }
      }),
    );
  });

  it("should plan at most one Time to train or Take it easy for a local day", () => {
    fc.assert(
      fc.property(reminderInput, (input) => {
        const days = planTrainingReminders(input)
          .filter(({ type }) => type === "train" || type === "ease")
          .map(({ fireAt }) => toLocalDate(new Date(fireAt), input.timeZone));

        expect(new Set(days).size).toBe(days.length);
      }),
      { numRuns: 500 },
    );
  });

  it("should plan nothing for a type that is off", () => {
    fc.assert(
      fc.property(reminderInput, (input) => {
        const types = new Set(planTrainingReminders(input).map(({ type }) => type));

        expect(types.has("train") && !input.settings.trainEnabled).toBe(false);
        expect(types.has("progress") && !input.settings.progressEnabled).toBe(false);
        expect(types.has("ease") && !input.settings.easeEnabled).toBe(false);
      }),
    );
  });

  it("should give no two reminders of one type in a plan the same variant, and not the one delivered last", () => {
    fc.assert(
      fc.property(reminderInput, (input) => {
        const reminders = planTrainingReminders(input);

        for (const type of TRAINING_REMINDER_TYPES) {
          const ids = reminders
            .filter((reminder) => reminder.type === type)
            .map(({ variantId }) => variantId);

          expect(new Set(ids).size).toBe(ids.length);
          if (ids.length > 0) {
            expect(ids[0]).not.toBe(input.lastVariantIds[type]);
          }
        }
      }),
    );
  });

  it("should plan the same again when planned a second time", () => {
    fc.assert(
      fc.property(reminderInput, (input) => {
        expect(planTrainingReminders(input)).toEqual(planTrainingReminders(input));
      }),
    );
  });
});
