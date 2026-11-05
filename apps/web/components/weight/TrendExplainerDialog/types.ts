export type TrendExplainerDialogProps = {
  /** Done, the close button, Escape or a press on the dimmed page. */
  onClose: () => void;
  /**
   * Where focus goes when the dialog closes. A click does not focus a button in every browser, so the
   * button that opened the dialog is named here and not left to what had focus.
   */
  returnFocusTo: Element | null;
};
