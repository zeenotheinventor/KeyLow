export type ChipGroupOption<Value extends string> = {
  value: Value;
  /** The words on the chip, such as "g" or "1 medium (100 g)". The screen builds them, so the unit's words are not this component's. */
  label: string;
};

/** Picks one of a few options as chips in a row that scrolls sideways, such as the unit an amount is in. */
export type ChipGroupProps<Value extends string> = {
  /** Names the group for a screen reader, such as "Unit". It reads it before the chips. */
  label: string;
  options: readonly ChipGroupOption<Value>[];
  /** The chosen option's value, or null while none is chosen. The screen keeps it. */
  value: Value | null;
  onChange: (value: Value) => void;
  /** Classes for the scrolling row itself, for the screen's layout. */
  className?: string;
};
