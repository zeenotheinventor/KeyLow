import type { RecentFood } from "@keylow/api-client";

export type RecentFoodsProps = {
  /** Dims every plus and stops it responding, such as while offline. */
  addDisabled: boolean;
  /** Logs the amount the food was last logged with. */
  onAdd: (recent: RecentFood) => void;
  /** Opens the portion picker for the food, with that amount filled in. */
  onOpen: (recent: RecentFood) => void;
};
