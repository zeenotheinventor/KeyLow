import type { LucideIcon } from "lucide-react";

export type EmptyStateAction = {
  label: string;
  icon?: LucideIcon;
  /** Secondary unless the state is the first thing a person does, such as the first recipe, where it is primary. */
  variant?: "primary" | "secondary";
} & ({ href: string; onClick?: never } | { onClick: () => void; href?: never });

/**
 * How much room the state takes, as the boards draw it in four places: the list on the foods page
 * (40 px above and below), a section of a page (48), the whole page (56) and a page that is not
 * built yet (64, with the body held to 360 px).
 */
export type EmptyStateSize = "list" | "section" | "page" | "placeholder";

/** The icon tile's colour: neutral, danger for a failure, and success for a state that is good news, such as nothing left to do. */
export type EmptyStateTone = "neutral" | "danger" | "success";

export type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  body?: string | undefined;
  /** Level one when the state is the whole page, level two when it fills a part of one. */
  headingLevel?: 1 | 2;
  /** The one thing to do next. It is a button, or a link when it goes to a page. */
  action?: EmptyStateAction | undefined;
  /** Danger toned icon, for a failure (`ErrorState` sets it), or success toned for good news. */
  tone?: EmptyStateTone;
  /** Set `alert` for a failure so it is announced. */
  role?: "alert" | "status";
  size?: EmptyStateSize;
  className?: string;
};
