import type { PlanDayView } from "@keylow/core/plans";

export type PlanDayCardProps = {
  view: PlanDayView;
  isToday: boolean;
  onPress: () => void;
};
