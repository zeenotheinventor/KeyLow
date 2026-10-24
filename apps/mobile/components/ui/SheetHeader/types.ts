import type { IconName } from "../Icon";
import type { ReactNode } from "react";

export type SheetHeaderControl = {
  icon: IconName;
  /** What the control does, as a short sentence case name. It is the control's accessible name. */
  label: string;
  /** Dims the control to 40 percent and stops it responding, as the recipe view does while offline. */
  disabled?: boolean | undefined;
  onPress: () => void;
};

/** The two controls on the right of a header that has two, such as Edit and More. */
export type SheetHeaderControlPair = readonly [SheetHeaderControl, SheetHeaderControl];

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
  /**
   * Close on the sheet header, back on the stack header. Left out, as the setup's first step has it, the
   * empty 44 point slot stays so the title keeps its place.
   */
  leading?: SheetHeaderControl | undefined;
  /**
   * The optional control on the right: create on the sheet header, close on the stack header. A header
   * can have two, side by side, such as the recipe view's Edit and More. The title then sits in the space
   * they leave.
   */
  trailing?: SheetHeaderControl | SheetHeaderControlPair | undefined;
  /** A line under the title in the secondary caption, such as a session's clock. */
  subtitle?: string | undefined;
  /**
   * Anything else at the right, such as a primary button. With no `trailing` control it takes the place of
   * the empty slot. With one, it is drawn after the control, as the routine editor has More and then Save.
   * Either way it sets the space the title is centred in.
   */
  trailingSlot?: ReactNode;
  /**
   * Whether the title is a heading for a screen reader. Defaults to true. A view that has its own
   * heading, as the food detail has the food's name, turns it off so there is one.
   */
  isTitleHeading?: boolean;
};
