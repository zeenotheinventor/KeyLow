import { planFoodReminders } from "@keylow/core/nutrition";
import { planTrainingReminders } from "@keylow/core/training";

import {
  lastDelivered,
  readScheduledReminders,
  writeScheduledReminders,
} from "./scheduledReminders";
import { getPermission, reminderTypes, replaceReminders } from "../notifications";

import type { Reminder, ReminderType } from "../notifications";
import type { ReminderSettings } from "../reminderSettings";
import type { FoodReminderInput } from "@keylow/core/nutrition";
import type { TrainingReminderInput } from "@keylow/core/training";

/** What the planner reads besides the settings and the moment. */
export type ReminderPlanInputs = Pick<
  TrainingReminderInput,
  "timeZone" | "plan" | "sessions" | "heatSets" | "weeklyGain"
>;

/** What the food planner reads besides the settings and the moment. */
export type FoodReminderPlanInputs = Pick<FoodReminderInput, "timeZone" | "loggedToday">;

export type ScheduleReminderPlanInput = {
  now: Date;
  settings: ReminderSettings;
  /** Null while any of it is not loaded yet, which leaves the schedule as it is. Unread while no training switch is on. */
  inputs: ReminderPlanInputs | null;
  /** Null while it is not loaded yet, which leaves the schedule as it is. Unread while the food switch is off. */
  foodInputs: FoodReminderPlanInputs | null;
};

const hasTrainingSwitchOn = ({ trainEnabled, progressEnabled, easeEnabled }: ReminderSettings) =>
  trainEnabled || progressEnabled || easeEnabled;

/**
 * Plans the next seven days of reminders, the training ones and the food one, and replaces what this app
 * has scheduled with them. With every switch off, or the permission not granted, it cancels ours and
 * schedules nothing, and on a build without the notifications module it does nothing at all. With the
 * inputs of a switch that is on not loaded it keeps the schedule it has. The plan is stored with the last
 * wording delivered of each type, so the next plan does not repeat it. A failure is a fixed message: the
 * system's own can quote what was scheduled.
 */
export async function scheduleReminderPlan({
  now,
  settings,
  inputs,
  foodInputs,
}: ScheduleReminderPlanInput): Promise<void> {
  const permission = await getPermission();
  if (permission === "unavailable") {
    return;
  }
  if (permission !== "granted" || !(hasTrainingSwitchOn(settings) || settings.foodEnabled)) {
    // Through the queue, so it cannot race a plan that is still being scheduled.
    await replaceReminders([]);
    return;
  }
  if (
    (inputs === null && hasTrainingSwitchOn(settings)) ||
    (foodInputs === null && settings.foodEnabled)
  ) {
    return;
  }

  const delivered = lastDelivered(await readScheduledReminders(), now);
  // `settings.lastVariant` is kept for older saved settings. The persisted plan is the source.
  const lastVariantOf = (type: ReminderType): string | null =>
    delivered.find((reminder) => reminder.type === type)?.variantId ?? settings.lastVariant[type];

  const trainingPlannedByCore =
    inputs === null
      ? []
      : planTrainingReminders({
          ...inputs,
          now: now.toISOString(),
          settings,
          lastVariantIds: {
            train: lastVariantOf("train"),
            progress: lastVariantOf("progress"),
            ease: lastVariantOf("ease"),
          },
        });
  // The core can also plan "missed" and "checkin", which the app does not switch on yet: it keeps the types it knows.
  const trainingPlanned = trainingPlannedByCore.flatMap((reminder) => {
    const type = reminderTypes.find((known) => known === reminder.type);
    return type === undefined ? [] : [{ ...reminder, type }];
  });
  const foodPlanned =
    foodInputs === null
      ? []
      : planFoodReminders({
          ...foodInputs,
          now: now.toISOString(),
          settings,
          lastVariantId: lastVariantOf("food"),
        }).map((reminder) => ({ ...reminder, type: "food" as const }));
  const planned = [...trainingPlanned, ...foodPlanned];
  const reminders: Reminder[] = planned.map(({ type, fireAt, title, body }) => ({
    type,
    fireAt: new Date(fireAt),
    title,
    body,
    data: { type },
  }));

  await replaceReminders(reminders);
  await writeScheduledReminders([
    ...delivered,
    ...planned.map(({ type, fireAt, variantId }) => ({ type, fireAt, variantId })),
  ]);
}
