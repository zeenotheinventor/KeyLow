export type ActiveUnderlineProps = {
  /** Which of the bar's slots the selected destination is in, counting the add button's slot. */
  slotIndex: number;
  /** How many equal slots the bar has: its destinations and the add button. */
  slotCount: number;
  /** The bar's width. It is 0 until the bar has been measured. */
  barWidth: number;
};
