export type DashboardTodayProps = {
  /** The profile's IANA time zone, which says what day it is. */
  timeZone: string;
  /** False makes no request, while the terms gate is up. */
  isReadEnabled: boolean;
};
