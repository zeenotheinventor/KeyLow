export type ReminderSwitchRowProps = {
  title: string;
  /** One plain line under the title that says when the reminder comes. */
  helper: string;
  isOn: boolean;
  /** Dims the row and stops the switch responding, for a build that cannot show reminders. */
  disabled?: boolean;
  onValueChange: (isOn: boolean) => void;
};
