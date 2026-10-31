import type { DashboardHeatBodyMap } from "@keylow/api-client";

export type DashboardBodyMapCardProps = {
  /** Actual heat now, the warmest three muscles and today's plan, as `useDashboardBodyMap` gives them. */
  bodyMap: DashboardHeatBodyMap;
};
