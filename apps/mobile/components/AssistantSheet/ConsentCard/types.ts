export type ConsentCardProps = {
  /** True while Turn on is saving: the button is busy and ignores another press. */
  isTurningOn: boolean;
  /** While offline Turn on is off, with the offline banner over the card, because saving would only wait. */
  isOnline: boolean;
  onTurnOn: () => void;
  onNotNow: () => void;
};
