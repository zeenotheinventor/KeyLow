/** The six reminder switches that count as "turning on a reminder", named one by one. */
export type ReminderSwitches = Readonly<{
  trainEnabled: boolean;
  progressEnabled: boolean;
  easeEnabled: boolean;
  missedEnabled: boolean;
  checkinEnabled: boolean;
  foodEnabled: boolean;
}>;

/**
 * Whether the person has turned on a reminder, which is what the Nudge Me badge reads. Each of the six
 * switches is named, so a switch added later (badges and levels, streak at risk) does not count by accident.
 */
export const reminderEnabledFrom = ({
  trainEnabled,
  progressEnabled,
  easeEnabled,
  missedEnabled,
  checkinEnabled,
  foodEnabled,
}: ReminderSwitches): boolean =>
  trainEnabled || progressEnabled || easeEnabled || missedEnabled || checkinEnabled || foodEnabled;
