/** What the gate is drawing: `open` is nothing, and the rest cover the app. */
export type TermsGateState = "loading" | "failed" | "accept" | "open";

export type TermsGateProps = {
  /** Called with what the gate is drawing, so the app can be hidden from a screen reader behind a cover, and sent off a route that iOS draws above it. */
  onStateChange: (state: TermsGateState) => void;
};
