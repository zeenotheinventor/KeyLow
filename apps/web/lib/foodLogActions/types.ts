import type { ReactNode } from "react";

/**
 * What an add food request says: the day on view, and the time only when an hour's plus asked for one.
 * A request with neither is "now": today in the profile's zone, at the moment the dialog opens.
 */
export type AddFoodRequest = {
  /** The day to log on, `YYYY-MM-DD`. Left out for today in the profile's zone. */
  date?: string;
  /** `HH:mm`, such as "12:00". Left out for "now on that day". Read only with a `date`. */
  time?: string;
};

export type FoodLogActions = {
  /** Opens the add food dialog for a day, with a time when an hour's plus was pressed. */
  openAddFood: (request: AddFoodRequest) => void;
  /** Opens the quick add dialog for a day, with a time when an hour's plus was pressed. */
  openQuickAdd: (request: AddFoodRequest) => void;
  /** Opens the edit dialog for a logged entry on the day on view. Does nothing away from the diary. */
  openEditEntry: (entryId: string) => void;
  /** The day the diary is showing, `YYYY-MM-DD`, or undefined away from the diary. The top bar's search adds food to it. */
  viewedDate: string | undefined;
  setViewedDate: (date: string | undefined) => void;
};

export type FoodLogActionsProviderProps = {
  children: ReactNode;
};
