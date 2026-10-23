import type { DashboardBodyMap } from "@keylow/api-client";
import type { BodyArtworkFigure } from "@keylow/core/training";

export type DashboardBodyMapCardProps = {
  /** Actual heat now, the warmest three muscles and today's plan, as `useDashboardBodyMap` gives them. */
  bodyMap: DashboardBodyMap;
  /** The figure drawn, from the figure setting. Defaults to male. */
  body?: BodyArtworkFigure | undefined;
  /** Opens the body map screen. The whole card is the button for it. */
  onOpen: () => void;
};
