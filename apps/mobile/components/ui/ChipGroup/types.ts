export type ChipGroupOption<Value extends string> = {
  value: Value;
  /** The words on the chip, such as "g" or "1 medium (100 g)". The screen builds them, so the unit's words are not this component's. */
  label: string;
};

/** How the chips sit: in one row that scrolls sideways, or in lines that wrap so every chip shows at once. */
export type ChipGroupLayout = "scroll" | "wrap";

type ChipGroupSharedProps<Value extends string> = {
  /** Names the group for a screen reader, such as "Unit". It reads it before the chips. */
  label: string;
  options: readonly ChipGroupOption<Value>[];
  /** `scroll` (the default) keeps a long label whole in a row that scrolls. `wrap` is for short labels that all fit on a few lines. */
  layout?: ChipGroupLayout | undefined;
  /** Classes for the group itself, for the screen's layout. */
  className?: string;
};

/** Picks one of a few options as chips, such as the unit an amount is in. */
export type ChipGroupProps<Value extends string> = ChipGroupSharedProps<Value> & {
  selection?: "single" | undefined;
  /** The chosen option's value, or null while none is chosen. The screen keeps it. */
  value: Value | null;
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
