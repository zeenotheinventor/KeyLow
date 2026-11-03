export type ConsentCardProps = {
  /** True while Turn on is saving: the button is busy and ignores another press. */
  isTurningOn: boolean;
  onTurnOn: () => void;
  onNotNow: () => void;
};
