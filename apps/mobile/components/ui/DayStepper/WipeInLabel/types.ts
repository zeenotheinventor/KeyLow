export type WipeInLabelProps = {
  /** The day's name, such as "Today". */
  children: string;
  /** Whether the label came from stepping back, which wipes it in from the other side. */
  isStepBack: boolean;
};
