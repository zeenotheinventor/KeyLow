export type DiaryDayProps = {
  /** The profile's IANA time zone, which the diary reads its days and hours in. */
  timeZone: string;
  /** False makes no request, while the terms gate is up. */
  isReadEnabled: boolean;
};
