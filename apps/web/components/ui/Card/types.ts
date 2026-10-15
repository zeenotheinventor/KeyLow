import type * as React from "react";

export type CardLevel = "surface" | "raised";

export type CardPadding = "default" | "none";

export type CardProps = Omit<React.HTMLAttributes<HTMLDivElement>, "title"> & {
  level?: CardLevel | null;
  padding?: CardPadding | null;
  /** A level two heading at the top of the card. */
  title?: React.ReactNode;
  /** Renders the card's styles on a single child such as a `section` or a `form`, which brings its own content and so its own title. */
  asChild?: boolean;
};
