import type { RecentFoodsProps } from "../RecentFoods";

export type LogIdleProps = RecentFoodsProps & {
  /** Opens the quick add form, with the day and the hour the sheet was opened for. */
  onQuickAdd: () => void;
};
