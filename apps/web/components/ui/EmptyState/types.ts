import type { LucideIcon } from "lucide-react";

export type EmptyStateAction = { label: string; icon?: LucideIcon } & (
  { href: string; onClick?: never } | { onClick: () => void; href?: never }
);

/**
 * How much room the state takes, as the boards draw it in four places: the list on the foods page
 * (40 px above and below), a section of a page (48), the whole page (56) and a page that is not
 * built yet (64, with the body held to 360 px).
 */
export type EmptyStateSize = "list" | "section" | "page" | "placeholder";

export type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  body?: string | undefined;
  /** Level one when the state is the whole page, level two when it fills a part of one. */
  headingLevel?: 1 | 2;
  /** The one thing to do next. It is a secondary button, or a link when it goes to a page. */
  action?: EmptyStateAction | undefined;
  /** Danger toned icon, for a failure. `ErrorState` sets it. */
  tone?: "neutral" | "danger";
  /** Set `alert` for a failure so it is announced. */
  role?: "alert" | "status";
  size?: EmptyStateSize;
  className?: string;
};
