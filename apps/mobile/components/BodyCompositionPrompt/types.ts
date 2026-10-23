export type BodyCompositionPromptProps = {
  /** The sentence on what is not allowed, in sentence case with its full stop. */
  text: string;
  /** The label of the text button under it: short, sentence case, no full stop. */
  action: string;
  onAction: () => void;
};
