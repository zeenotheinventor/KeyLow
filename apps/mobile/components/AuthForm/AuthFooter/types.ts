import type { AuthFormFooter } from "../types";

export type AuthFooterProps = {
  footer: AuthFormFooter;
  /**
   * `caption` is the sign up board's: 12 over 16 with the link underlined in the accent ink. `body` is the
   * sign in board's. Defaults to `body`.
   */
  size?: "body" | "caption";
  /**
   * Runs in place of the link's navigation, for a screen that must return to the screen below it and not
   * push another copy of it, such as the forgot password form's Sign in. Draws the body size link.
   */
  onPress?: (() => void) | undefined;
};
