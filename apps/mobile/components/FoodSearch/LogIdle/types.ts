import type { RecentFoodsProps } from "../RecentFoods";

export type LogIdleProps = RecentFoodsProps & {
  /** Opens the quick add form. */
  onQuickAdd: () => void;
};
