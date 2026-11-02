import type { DashboardBodyMap } from "@keylow/api-client";
import type { BodyArtworkFigure } from "@keylow/core/training";

export type DashboardBodyMapCardProps = {
  /** The chart the card shows: Heat (the default) or this week's volume. */
  scale?: "heat" | "volume" | undefined;
  /**
   * What the card shows, as `useDashboardBodyMap` gives it. In Heat that is Actual heat now, the warmest three
   * muscles and today's plan. In Volume `values` are the volume statuses of this week instead (as `useBodyMap`
   * gives them on Volume), `warmest` is not read, and `today` is still today's plan.
   */
  bodyMap: DashboardBodyMap;
  /** The figure drawn, from the figure setting. Defaults to male. */
  body?: BodyArtworkFigure | undefined;
  /** Opens the body map screen. The whole card is the button for it. */
  onOpen: () => void;
};
