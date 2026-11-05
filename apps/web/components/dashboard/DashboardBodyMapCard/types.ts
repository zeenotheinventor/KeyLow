import type { DashboardBodyMap } from "@keylow/api-client";
import type { BodyArtworkFigure, DashboardBodyChart } from "@keylow/core/training";

export type DashboardBodyMapCardProps = {
  /**
   * What the card shows, as `useDashboardBodyMap` gives it. In Weekly volume `values` are the week's volume
   * statuses and `warmest` is not used.
   */
  bodyMap: DashboardBodyMap;
  /** The figure drawn. Defaults to male. */
  body?: BodyArtworkFigure | undefined;
  /** The chart the card draws: Heat, the default, or Weekly volume. */
  scale?: DashboardBodyChart | undefined;
};
