export type ResetLinkNotValidProps = {
  /** Opens the forgot password screen with an empty field, for a link that cannot be used again. */
  onSendNewLink: () => void;
  /** Takes the person back to the sign in screen. */
  onBackToSignIn: () => void;
};
