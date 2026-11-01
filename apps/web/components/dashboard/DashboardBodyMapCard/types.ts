import type { DashboardBodyMap } from "@keylow/api-client";

export type DashboardBodyMapCardProps = {
  /**
   * The chart of the Dashboard chart setting and today's plan, as `useDashboardBodyMap` gives them: Actual
   * heat now with the warmest three, or the week's actual sets with the most trained three.
   */
  bodyMap: DashboardBodyMap;
};
