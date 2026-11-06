export type BackToResultsProps = {
  onClick: () => void;
  /** What the link says. It is "Results" for the search, and "Your plate" when the step was opened from a plate row. */
  label?: string | undefined;
  /** Dims the link and stops it responding, while the plate is being logged. */
  disabled?: boolean | undefined;
};
