export type ChipGroupOption<Value extends string> = {
  value: Value;
  label: string;
};

type ChipGroupSharedProps<Value extends string> = {
  /** Names the group for assistive technology, such as "Unit". */
  label: string;
  options: readonly ChipGroupOption<Value>[];
  /**
   * Called after `onChange` on every click on a chip, the chosen one included, which `onChange` alone never
   * hears. The arrow, Home and End keys walk the chips and do not call it.
   */
  onChipPress?: ((value: Value) => void) | undefined;
  className?: string;
};

/** Picks one of a few short options as chips that wrap, such as the unit an amount is in. */
export type ChipGroupSingleProps<Value extends string> = ChipGroupSharedProps<Value> & {
  selection?: "single" | undefined;
  value: Value;
  onChange: (value: Value) => void;
};

/** Picks any number of the options as chips, such as the equipment a person can use. */
export type ChipGroupMultipleProps<Value extends string> = ChipGroupSharedProps<Value> & {
  selection: "multiple";
  /** The chosen options' values, in the order they were chosen. The screen keeps them. */
  value: readonly Value[];
  /** Hands on all the chosen values after a chip is pressed: the pressed one added at the end, or taken out. */
  onChange: (next: Value[]) => void;
};

/**
 * Chips that are one-shot buttons, for a quick reply such as the assistant's: each press does something at
 * once and nothing is chosen. The chips are buttons in a plain group, with no radio group and no selected
 * state, and `onChipPress` hears each press. Every chip is in the tab order, and the arrow keys are not used.
 */
export type ChipGroupActionProps<Value extends string> = Omit<
  ChipGroupSharedProps<Value>,
  "onChipPress"
> & {
  selection: "action";
  /** Dims every chip and stops it responding, for a quick reply to a question that cannot be answered now. */
  disabled?: boolean | undefined;
  onChipPress: (value: Value) => void;
};

export type ChipGroupProps<Value extends string> =
  ChipGroupSingleProps<Value> | ChipGroupMultipleProps<Value> | ChipGroupActionProps<Value>;
