import type { WeighIn } from "@keylow/api-client";
import type { ReactNode } from "react";

export type WeightListProps = {
  /** Every weigh-in, newest first, as the hook returns them. */
  weighIns: readonly WeighIn[];
  /** Today in the profile's time zone, `YYYY-MM-DD`. */
  today: string;
  /** The days the trend left out, by `YYYY-MM-DD`. */
  isLeftOut: (localDate: string) => boolean;
  /** What the list scrolls with above the Weigh-ins heading, such as the trend card. Nothing yet. */
  header?: ReactNode;
  /** What sits beside the Weigh-ins heading, such as the Health Connect status. */
  status?: ReactNode;
  /** Whether the pull to refresh is spinning. */
  isRefreshing: boolean;
  /** Called when the list is pulled down. */
  onRefresh: () => void;
};
