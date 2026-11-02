import type { BodyMapScale } from "@keylow/core/copy";

export type BodyMapLegendProps = {
  /** The scale the legend is the key to: Heat from Rested to Peak, Volume, or Gap. */
  scale: BodyMapScale;
  /**
   * "wide" is the legend under the body map, with the name of every step and a line on what they mean. "strip"
   * is the compact column beside the figures of the dashboard card, from High to None, and only Volume has
   * one, so any other scale draws the wide legend.
   */
  variant?: "wide" | "strip" | undefined;
};
