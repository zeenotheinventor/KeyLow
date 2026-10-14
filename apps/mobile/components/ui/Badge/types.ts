import type { FoodSource } from "@keylow/core/schemas";

/** The design system's status tones: neutral, the accent, the three statuses and the four macros. */
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

/** Names where a food came from. The text is the source's own name, so it takes no children. */
export type SourceBadgeProps = {
  kind: "source";
  source: FoodSource;
  tone?: never;
  dot?: never;
  children?: never;
};

/** A short status with a tone, and an optional dot before the text. */
export type StatusBadgeProps = {
  kind?: "status";
  /** Defaults to `neutral`. */
  tone?: BadgeTone;
  /** A decoration. The text carries the meaning. */
  dot?: boolean;
  source?: never;
  /** One short phrase from `@keylow/core/copy`, such as "Default". */
  children: string;
};

export type BadgeProps = SourceBadgeProps | StatusBadgeProps;
