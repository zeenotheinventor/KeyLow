import type { ReactNode } from "react";

/** What an add food request says: the day on view, and the time only when an hour's plus asked for one. */
export type AddFoodRequest = {
  /** The day to log on, `YYYY-MM-DD`. */
  date: string;
  /** `HH:mm`, such as "12:00". Left out for "now on that day". */
  time?: string;
};

export type FoodLogActions = {
  /** Opens the add food dialog for a day, with a time when an hour's plus was pressed. */
  openAddFood: (request: AddFoodRequest) => void;
  /** Opens the edit dialog for a logged entry on the day on view. */
  openEditEntry: (entryId: string) => void;
  /** The day the diary is showing, `YYYY-MM-DD`, or undefined away from the diary. The top bar's search adds food to it. */
  viewedDate: string | undefined;
  setViewedDate: (date: string | undefined) => void;
};

export type FoodLogActionsProviderProps = {
  children: ReactNode;
};
