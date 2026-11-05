export type TrainBodyMapProps = {
  /** The profile's IANA time zone, which the days and the moment are written in. */
  timeZone: string;
  /** When the oldest of the Train page's reads was made. Offline it is the moment the card shows. */
  savedAt: Date;
};
