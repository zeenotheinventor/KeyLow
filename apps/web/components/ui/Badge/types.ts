import type { FoodSource } from "@keylow/core/schemas";
import type * as React from "react";

export type BadgeTone =
  | "neutral"
  | "accent"
  | "success"
  | "warning"
  | "danger"
  | "protein"
  | "carbs"
  | "fat"
  | "calories";

type BadgeElementProps = Omit<React.HTMLAttributes<HTMLSpanElement>, "children">;

/** Names where a food came from. The text is the source's name, so it takes no children. */
export type SourceBadgeProps = BadgeElementProps & {
  kind: "source";
  source: FoodSource;
  tone?: never;
  dot?: never;
  outlined?: never;
  children?: never;
};

/** A short status with a tone, and an optional dot before the text. */
export type StatusBadgeProps = BadgeElementProps & {
  kind?: "status";
  tone?: BadgeTone;
  /** A decoration. The text carries the meaning. */
  dot?: boolean;
  /**
   * Draws the badge as the boards draw the assistant's Estimate: a hairline border, and for the neutral tone the
   * raised fill instead of the sheet fill. The phone's `outlined` is the twin, which follows the board here.
   */
  outlined?: boolean;
  source?: never;
  children: React.ReactNode;
};

export type BadgeProps = SourceBadgeProps | StatusBadgeProps;
