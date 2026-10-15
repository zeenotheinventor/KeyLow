import type { AuthFormFooter } from "../types";

export type AuthFooterProps = {
  footer: AuthFormFooter;
  /**
   * `caption` is the sign up board's: 12 over 16 with the link underlined in the accent ink. `body` is the
   * sign in board's. Defaults to `body`.
   */
  size?: "body" | "caption";
};
