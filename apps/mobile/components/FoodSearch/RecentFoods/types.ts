import type { RecentFood } from "@keylow/api-client";

export type RecentFoodsProps = {
  /** Dims every plus and stops it responding, such as while offline. */
  addDisabled?: boolean | undefined;
  /** Logs the amount the food was last logged with. Leave it out for rows with no plus, which only open the food. */
  onAdd?: ((recent: RecentFood) => void) | undefined;
  /** Opens the portion picker for the food, with that amount filled in. */
  onOpen: (recent: RecentFood) => void;
};
