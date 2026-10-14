import type { IconName } from "../Icon";

export type SheetHeaderControl = {
  icon: IconName;
  /** What the control does, as a short sentence case name. It is the control's accessible name. */
  label: string;
  onPress: () => void;
};

/**
 * `sheet` is the header of the sheet itself, as the search sheet has it: raised controls and a large
 * title. `stack` is the header of a view inside the sheet, such as a food, the food form or the scanner:
 * clear controls and a compact title.
 */
export type SheetHeaderVariant = "sheet" | "stack";

export type SheetHeaderProps = {
  /** Defaults to `sheet`. */
  variant?: SheetHeaderVariant;
  title: string;
  /** Close on the sheet header, back on the stack header. */
  leading: SheetHeaderControl;
  /** The optional control on the right: create on the sheet header, close on the stack header. */
  trailing?: SheetHeaderControl | undefined;
  /**
   * Whether the title is a heading for a screen reader. Defaults to true. A view that has its own
   * heading, as the food detail has the food's name, turns it off so there is one.
   */
  isTitleHeading?: boolean;
};
