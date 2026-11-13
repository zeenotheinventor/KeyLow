export type PlanAddToListScreenProps = {
  /** The first day to buy for, `YYYY-MM-DD`, from the address. Undefined or not a date shows the not found state. */
  start: string | undefined;
  /** The last day to buy for, `YYYY-MM-DD`. The same as `start` for one day. */
  end: string | undefined;
};
