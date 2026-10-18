import type { DashboardBodyMap } from "@keylow/api-client";

export type DashboardBodyMapCardProps = {
  /** Actual heat now, the warmest three muscles and today's plan, as `useDashboardBodyMap` gives them. */
  bodyMap: DashboardBodyMap;
  /** Opens the body map screen. The whole card is the button for it. */
  onOpen: () => void;
};
