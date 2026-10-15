export type DiaryWeekProps = {
  /** The day on view, `YYYY-MM-DD`. The week is the one that holds it. */
  viewedDate: string;
  /** Today, `YYYY-MM-DD`. */
  today: string;
  /** The profile's IANA time zone, which Copy to today copies in. */
  timeZone: string;
};
