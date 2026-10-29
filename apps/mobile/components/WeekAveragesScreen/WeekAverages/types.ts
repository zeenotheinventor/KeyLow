export type WeekAveragesProps = {
  /** Today in the profile's time zone, `YYYY-MM-DD`: the week to read is the one that holds it. */
  today: string;
  /** False while the terms gate is up, so nothing is read. */
  isReadEnabled: boolean;
};
