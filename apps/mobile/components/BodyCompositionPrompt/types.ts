/**
 * The stacked compact prompt of the permission flow's `connected · partial`: a sentence over a text button.
 * It is the default, so the flow's own use needs no variant.
 */
export type BodyCompositionStackedPromptProps = {
  variant?: "stacked";
  /** The sentence on what is not allowed, in sentence case with its full stop. */
  text: string;
  /** The label of the text button under it: short, sentence case, no full stop. */
  action: string;
  onAction: () => void;
};

/** The Weight screen's `partial` prompt: one row with the sentence on the left and a text button on the right. */
export type BodyCompositionCompactPromptProps = {
  variant: "compact";
  text: string;
  action: string;
  onAction: () => void;
};

/** The `not-allowed` prompt: the accent tile with the heart, a title, a text and a text button to the permission flow. */
export type BodyCompositionNotAllowedPromptProps = {
  variant: "not-allowed";
  title: string;
  text: string;
  action: string;
  onAction: () => void;
};

/** The `no-readings-yet` prompt: the muted tile with the scale, a title and a text, and nothing to press. */
export type BodyCompositionNoReadingsPromptProps = {
  variant: "no-readings-yet";
  title: string;
  text: string;
};

/** The `error` prompt: the danger tile, an alert with a title and a text, and a quiet text button to try again. */
export type BodyCompositionErrorPromptProps = {
  variant: "error";
  title: string;
  text: string;
  /** The label of the text button: "Try again". */
  retry: string;
  onRetry: () => void;
};

export type BodyCompositionPromptProps =
  | BodyCompositionStackedPromptProps
  | BodyCompositionCompactPromptProps
  | BodyCompositionNotAllowedPromptProps
  | BodyCompositionNoReadingsPromptProps
  | BodyCompositionErrorPromptProps;
