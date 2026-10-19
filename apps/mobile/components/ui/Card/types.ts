import type { ReactNode } from "react";
import type { ViewProps } from "react-native";

/**
 * Which surface the card sits on. `surface` is for a card that sits on the screen's background, and
 * `raised` is for a card that sits on a surface, so the stack of surfaces stays legible.
 */
export type CardLevel = "surface" | "raised";

/** The colour of the 1 point border: the hairline, or the accent for the one card a screen sets apart, such as the active routine's. */
export type CardBorder = "default" | "accent";

/** A step of the spacing scale, at 4 points a step: 0 for none, 3 for 12 points, 4 for 16. */
export type CardPadding = 0 | 3 | 4;

export type CardProps = Pick<ViewProps, "role" | "aria-label"> & {
  /** Defaults to `surface`. */
  level?: CardLevel;
  /** Defaults to `default`. */
  border?: CardBorder;
  /** Defaults to 4, the design's `--space-4`. A card of rows that bring their own padding takes 0. */
  padding?: CardPadding;
  children: ReactNode;
};
