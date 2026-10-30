import type { DashboardBodyMap } from "@keylow/api-client";
import type { BodyArtworkFigure } from "@keylow/core/training";

export type DashboardBodyMapCardProps = {
  /** Actual heat now, the warmest three muscles and today's plan, as `useDashboardBodyMap` gives them. */
  bodyMap: DashboardBodyMap;
  /** The figure drawn. Defaults to male. */
  body?: BodyArtworkFigure | undefined;
};
