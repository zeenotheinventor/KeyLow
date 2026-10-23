import type { LabelAnchor } from "@keylow/core/training";

export type BarLabelProps = {
  text: string;
  /** Which edge of the mark the label hangs from. A centred label is centred on its mark. */
  anchor: LabelAnchor;
  /** The class that puts a centred label's middle on its mark, reading the mark's variable. */
  markClassName: string;
  /** The class that sets the row the label is on, under the bar. */
  rowClassName: string;
  tone: "muted" | "secondary";
};
