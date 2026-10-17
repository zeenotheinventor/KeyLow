export type DashboardWeekProps = {
  /** Today in the profile's time zone, `YYYY-MM-DD`: the day the Today card shows, and so the week to read. */
  today: string;
  /** False makes no request, while the terms gate is up. */
  isReadEnabled: boolean;
};
