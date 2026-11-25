export type AuthSwitchLinkProps = {
  /** The question, such as "Already have an account?". */
  prompt: string;
  /** The link that answers it. */
  linkLabel: string;
  href: string;
  /** `centred` is the forgot password page's footer: body size, in the middle, with a 44 px link. The default is the caption under the card. */
  variant?: "default" | "centred";
};
