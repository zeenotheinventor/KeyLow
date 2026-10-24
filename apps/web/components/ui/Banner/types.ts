import type { LucideIcon } from "lucide-react";
import type * as React from "react";

export type BannerTone = "info" | "review" | "error";

/** Where the action sits. Trailing is at the end of the row, below is a link under the message. Info goes below, review and error trailing, unless told. */
export type BannerActionPlacement = "trailing" | "below";

export type BannerAction = { label: string } & (
  | {
      href: string;
      /** Opens the link in a new tab, for a screen whose unsaved work a page change would lose. Say so in the label. */
      newTab?: boolean | undefined;
      onClick?: never;
    }
  | { onClick: () => void; href?: never; newTab?: never }
);

export type BannerProps = {
  /** Info is neutral, review is warning toned and error is danger toned. */
  tone?: BannerTone;
  /** A short heading. Without one, the children are the whole message. */
  title?: string;
  /** The message, or the body under the title. */
  children: React.ReactNode;
  /** Replaces the tone's icon. */
  icon?: LucideIcon;
  /** Info is a status, review is a note and an error is an alert. A screen can choose another. */
  role?: "alert" | "status" | "note";
  action?: BannerAction;
  actionPlacement?: BannerActionPlacement;
  className?: string;
};
