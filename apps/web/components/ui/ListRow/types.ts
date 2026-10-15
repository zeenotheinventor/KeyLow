import type { ComponentType } from "react";

/** What the row needs of an icon: the props it sets. A `lucide-react` icon fits. */
export type ListRowIcon = ComponentType<{
  className?: string;
  strokeWidth?: number;
  "aria-hidden"?: boolean;
}>;

type ListRowContent = {
  /** A leading icon, such as `Shield` from `lucide-react`, in a small tile. It is decorative: the title names the row. */
  icon?: ListRowIcon;
  title: string;
  subtitle?: string | undefined;
  /** A short value that sits after the title, before the chevron, such as the calorie target on the Targets row. */
  value?: string | undefined;
  /** The chevron marks a row that goes somewhere. Leave it off for an action such as signing out. */
  chevron?: boolean;
  disabled?: boolean;
  className?: string;
};

/** A row goes to a page, runs an action, submits the form around it, or is plain text. It cannot do two of these. */
export type ListRowProps = ListRowContent &
  (
    | { href: string; onClick?: never; submit?: never }
    | { onClick: () => void; href?: never; submit?: never }
    | { submit: true; href?: never; onClick?: never }
    | { href?: never; onClick?: never; submit?: never }
  );
