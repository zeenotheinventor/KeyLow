import type { RecentFood } from "@keylow/api-client";

export type RecentFoodsProps = {
  /** Dims every plus and stops it responding, such as while the plate is being logged. */
  addDisabled?: boolean | undefined;
  /** Puts the amount the food was last logged with on the plate. Leave it out for rows with no plus, which only open the food. */
  onAdd?: ((recent: RecentFood) => void) | undefined;
  /** Opens the portion picker for the food, with that amount filled in. */
  onOpen: (recent: RecentFood) => void;
};
