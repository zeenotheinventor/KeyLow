export type ChipGroupOption<Value extends string> = {
  value: Value;
  /** The words on the chip, such as "g" or "1 medium (100 g)". The screen builds them, so the unit's words are not this component's. */
  label: string;
};

/**
 * How the chips sit: in one row that scrolls sideways, in lines that wrap so every chip shows at once, or in
 * one row of equal columns, 44 points high, for a few short labels such as the set entry's RIR 0 to 6+.
 */
export type ChipGroupLayout = "scroll" | "wrap" | "equal";

type ChipGroupSharedProps<Value extends string> = {
  /** Names the group for a screen reader, such as "Unit". It reads it before the chips. */
  label: string;
  options: readonly ChipGroupOption<Value>[];
  /** `scroll` (the default) keeps a long label whole in a row that scrolls. `wrap` is for short labels that all fit on a few lines. `equal` shares one line between a few very short labels. */
  layout?: ChipGroupLayout | undefined;
  /** Classes for the group itself, for the screen's layout. */
  className?: string;
  /** Hears every press of a chip, the chosen one too, after `onChange` where that runs. For a screen that does something more than change the choice, such as moving focus to the field the chip belongs to. */
  onChipPress?: (value: Value) => void;
};

/** Picks one of a few options as chips, such as the unit an amount is in. */
export type ChipGroupProps<Value extends string> = ChipGroupSharedProps<Value> & {
  selection?: "single" | undefined;
  /** The chosen option's value, or null while none is chosen. The screen keeps it. */
  value: Value | null;
  onChange: (value: Value) => void;
};

/**
 * Picks one of a few options as chips, and lets the person take the choice back by pressing the chosen chip
 * again, for a value that is optional, such as RIR. Then no option is chosen and `onChange` is given null.
 */
export type ChipGroupClearableProps<Value extends string> = ChipGroupSharedProps<Value> & {
  selection?: "single" | undefined;
  allowDeselect: true;
  value: Value | null;
  onChange: (value: Value | null) => void;
};

/** Picks any number of the options as chips, such as the equipment a person can use. */
export type ChipGroupMultipleProps<Value extends string> = ChipGroupSharedProps<Value> & {
  selection: "multiple";
  /** The chosen options' values, in the order they were chosen. The screen keeps them. */
  value: readonly Value[];
  /** Hands on all the chosen values after a chip is pressed: the pressed one added at the end, or taken out. */
  onChange: (next: Value[]) => void;
};
