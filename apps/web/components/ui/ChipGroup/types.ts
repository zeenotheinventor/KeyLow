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
  className?: string;
};
