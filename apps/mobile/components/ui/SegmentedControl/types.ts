export type SegmentedControlOption<Value extends string> = {
  value: Value;
  /** The words on the segment: short, from `@keylow/core/copy` where a screen has them there. */
  label: string;
};

/** Picks one of two to five short options, such as the basis of a food's nutrition or the appearance. */
export type SegmentedControlProps<Value extends string> = {
  /** What the group is for, such as "Nutrition basis". A screen reader reads it before the options. */
  label: string;
  options: readonly SegmentedControlOption<Value>[];
  value: Value;
  onChange: (value: Value) => void;
  /** `md` (the default) is the 44 point track. `sm` is the 36 point track with a 12 point label, for a row that has other things in it. */
  size?: "md" | "sm" | undefined;
};
