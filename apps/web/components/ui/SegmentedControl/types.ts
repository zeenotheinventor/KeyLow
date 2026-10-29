export type SegmentedControlOption<Value extends string> = {
  value: Value;
  label: string;
};

type SegmentedControlName =
  | { label: string; labelledBy?: never }
  /** The id of text on the page that names the group, such as a heading beside it. */
  | { labelledBy: string; label?: never };

/** Picks one of two to five short options, such as the basis of a food's nutrition or the appearance. */
export type SegmentedControlProps<Value extends string> = SegmentedControlName & {
  options: readonly SegmentedControlOption<Value>[];
  value: Value;
  onChange: (value: Value) => void;
  /** `md` (the default) is the 44 px track. `sm` is the 36 px track with a 12 px label, for a row that has other things in it. */
  size?: "md" | "sm" | undefined;
  className?: string;
};
