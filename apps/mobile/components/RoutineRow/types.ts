export type RoutineRowAction = {
  /** The button's label, such as "Make active". */
  label: string;
  /** The button's name for a screen reader, which names the routine: "Make active, Upper Lower". */
  accessibilityLabel: string;
  onPress: () => void;
};

export type RoutineRowProps = {
  name: string;
  /** The line under the name: the days, the weekdays and the sets, already written by core. */
  meta: string;
  /** Opens the routine. The name is plain text without it. */
  onPress?: (() => void) | undefined;
  /** The button beside the name, such as Make active or Restore. Nothing is drawn without it. */
  action?: RoutineRowAction | undefined;
};
