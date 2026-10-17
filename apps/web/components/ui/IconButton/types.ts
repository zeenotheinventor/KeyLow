import type { LucideIcon } from "lucide-react";
import type * as React from "react";

/**
 * Everything a button takes, so `aria-pressed`, `aria-expanded`, `disabled` and `onClick` pass through,
 * except what the button sets itself: its name comes from `label` alone, the icon is its only content, and
 * a screen places it with a wrapper rather than a class.
 */
export type IconButtonProps = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "aria-label" | "aria-labelledby" | "children" | "className" | "type"
> & {
  /** The icon, a Lucide component. It is drawn at 18 px and hidden from assistive technology. */
  icon: LucideIcon;
  /** What the button does, such as "Move step 2 up". It is the button's accessible name, and it is required. */
  label: string;
};
