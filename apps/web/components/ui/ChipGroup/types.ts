export type ChipGroupOption<Value extends string> = {
  value: Value;
  label: string;
};

/** Picks one of a few short options as chips that wrap, such as the unit an amount is in. */
export type ChipGroupProps<Value extends string> = {
  /** Names the group for assistive technology, such as "Unit". */
  label: string;
  options: readonly ChipGroupOption<Value>[];
  value: Value;
  onChange: (value: Value) => void;
  /**
   * Called after `onChange` on every click on a chip, the chosen one included, which `onChange` alone never
   * hears. The arrow, Home and End keys walk the chips and do not call it.
   */
  onChipPress?: ((value: Value) => void) | undefined;
  className?: string;
};
