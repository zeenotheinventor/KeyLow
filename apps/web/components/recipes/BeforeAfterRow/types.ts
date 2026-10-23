import type { BeforeAfterFigures } from "@keylow/core/copy";

/** The colour square before a macro's name, as the macro bars draw it. `none` keeps the room and draws nothing, so the labels line up. */
export type BeforeAfterMarker = "protein" | "carbs" | "fat" | "none";

export type BeforeAfterRowProps = {
  /** What the figure is. Leave it out for a figure that sits under a title that says it, such as an ingredient's calories. */
  label?: string | undefined;
  figures: BeforeAfterFigures;
  marker?: BeforeAfterMarker | undefined;
  /** `regular` is 40 px tall, for the Per serving card. `compact` is 32, for the per 100 values. `plain` is as tall as its words, for the line beside an ingredient's title. Defaults to `regular`. */
  size?: "regular" | "compact" | "plain" | undefined;
  /** Draws a hairline above the row. */
  hasDivider?: boolean | undefined;
};
