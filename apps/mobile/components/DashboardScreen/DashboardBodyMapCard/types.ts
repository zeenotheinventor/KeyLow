import type { DashboardBodyMap } from "@keylow/api-client";
import type { BodyArtworkFigure } from "@keylow/core/training";

export type DashboardBodyMapCardProps = {
  /**
   * The chart of the Dashboard chart setting and today's plan, as `useDashboardBodyMap` gives them: Actual
   * heat now with the warmest three, or the week's actual sets with the most trained three.
   */
  bodyMap: DashboardBodyMap;
  /** The figure drawn, from the figure setting. Defaults to male. */
  body?: BodyArtworkFigure | undefined;
  /** Opens the body map screen. The whole card is the button for it. */
  onOpen: () => void;
};
