import type { LucideIcon } from "lucide-react";
import type * as React from "react";

/**
 * Everything a button takes, so `aria-pressed`, `aria-expanded`, `disabled` and `onClick` pass through,
 * except what the button sets itself: its name comes from `label` alone, the icon is its only content, and
 * a screen places it with a wrapper rather than a class.
 */
export type IconButtonSize = "default" | "card";

export type IconButtonProps = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "aria-label" | "aria-labelledby" | "children" | "className" | "type"
> & {
  /** The icon, a Lucide component. It is drawn at 18 px and hidden from assistive technology. */
  icon: LucideIcon;
  /** What the button does, such as "Move step 2 up". It is the button's accessible name, and it is required. */
  label: string;
  /**
   * `default` is the 36 px square. `card` is the 40 px square of the body map card's header, with a border and
   * a raised fill.
   */
  size?: IconButtonSize | undefined;
  /**
   * Draws the accent fill, border and glyph, as a toggle that is on looks. It is the look only, so a toggle
   * also sets `aria-pressed` itself.
   */
  isSelected?: boolean | undefined;
  /**
   * Fills the glyph with the accent colour, as a choice that is on looks, such as a favourite's heart. The
   * button keeps its rest fill and border. The look only: the name says the state, so do not set
   * `aria-pressed` as well. `isSelected` wins when both are set.
   */
  isFilled?: boolean | undefined;
};
