import type { GoogleSignInResult } from "../../lib/googleSignIn";
import type { Credentials, PasswordRule } from "../../lib/validateCredentials";
import type { Href } from "expo-router";

/**
 * What a sign in came to. An error carries Supabase's error code, never its message, so the form can
 * only say one of core's fixed sentences. A sign up that needs the email confirmed names the address.
 */
export type AuthFormOutcome =
  | { status: "done" }
  | { status: "error"; code: string | undefined }
  | { status: "check-email"; email: string };

/** The line under the buttons that links to the other of the two screens. */
export type AuthFormFooter = {
  prompt: string;
  linkLabel: string;
  href: Href;
};

export type AuthFormProps = {
  heading: string;
  submitLabel: string;
  passwordRule: PasswordRule;
  onSubmit: (credentials: Credentials) => Promise<AuthFormOutcome>;
  footer: AuthFormFooter;
  /**
   * Draws the sign up board: the acceptance checkbox, unticked, with the Google button and the primary
   * button both disabled until it is ticked. Only the sign up screen sets it.
   */
  requireAcceptance?: boolean | undefined;
  /** What the Google button runs. Defaults to a plain Google sign-in. */
  onGoogleSignIn?: (() => Promise<GoogleSignInResult>) | undefined;
};
