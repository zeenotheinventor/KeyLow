/** Where the screen is reached from: Sign in (signed out), or the Delete account confirm (signed in). */
export type ForgotPasswordOrigin = "signIn" | "deleteAccount";

export type ForgotPasswordScreenProps = {
  /**
   * Which words the way back is written in. From Sign in, the default, it is Back to sign in and the form
   * offers Sign in under the button. From Delete account it is Back, with no Sign in line, and the sent
   * message says Back to Delete account.
   */
  from?: ForgotPasswordOrigin | undefined;
  /** Takes the person back to where they came from, whichever words it is written in. */
  onBackToSignIn: () => void;
};
