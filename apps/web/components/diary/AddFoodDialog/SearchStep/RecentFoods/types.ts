import type { RecentFood } from "@keylow/api-client";

export type RecentFoodsProps = {
  /** Dims the plus and stops it responding, such as while offline. */
  addDisabled: boolean;
  /** A press on a row: go to the portion step at the amount it was last logged with. */
  onOpen: (food: RecentFood) => void;
  /** A press on a row's plus: log the amount it was last logged with at once. Leave it out for rows with no plus. */
  onAdd?: ((food: RecentFood) => void) | undefined;
};
