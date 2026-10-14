import { GENERIC_ERROR } from "./errors";

export const SIGN_IN_REFUSED = "Email or password is not right. Check them and try again.";

/** The web login message after an email link failed. */
export const SIGN_IN_LINK_NOT_VERIFIED =
  "That sign-in link could not be verified. Sign in again, or request a new link.";

/** The mobile screen after an email link failed. */
export const SIGN_IN_LINK_INVALID = {
  title: "Link not valid",
  body: "This sign-in link is not valid. It may have expired or already been used.",
};

/**
 * What the mobile sign in and sign up boards say. The two screens share one layout and differ in the
 * heading, the button, and the line that links to the other.
 */
export const AUTH_SCREEN = {
  signIn: {
    heading: "Welcome back",
    submitLabel: "Sign in",
    footerPrompt: "New to Ki-Lo?",
    footerLink: "Create account",
  },
  signUp: {
    heading: "Create your account",
    submitLabel: "Create account",
    footerPrompt: "Already have an account?",
    footerLink: "Sign in",
  },
  emailLabel: "Email",
  passwordLabel: "Password",
  googleButton: "Continue with Google",
  signingInLink: "Signing you in",
  backToSignIn: "Back to sign in",
};

export const PASSWORD_HELPER = "At least 8 characters";

export const AUTH_FIELD_PROBLEMS = {
  emailRequired: "Enter your email address",
  emailInvalid: "Enter a valid email address",
  passwordRequired: "Enter your password",
  passwordTooShort: "Password must be at least 8 characters",
};

export const CHECK_EMAIL_TITLE = "Check your email";

export const describeCheckEmail = (email: string): string =>
  `Open the confirmation link sent to ${email} to finish creating your account.`;

const ACCOUNT_EXISTS = "An account with this email already exists. Sign in instead.";
const TOO_MANY_ATTEMPTS = "Too many attempts. Wait a few minutes, then try again.";

// The keys are Supabase auth error codes, checked against @supabase/auth-js 2.117.2
// (src/lib/error-codes.ts). "network" is not a server code: a failed fetch is an
// AuthRetryableFetchError with no code, so the caller passes "network" for it.
const AUTH_ERROR_SENTENCES: ReadonlyMap<string, string> = new Map([
  ["invalid_credentials", SIGN_IN_REFUSED],
  ["user_already_exists", ACCOUNT_EXISTS],
  ["email_exists", ACCOUNT_EXISTS],
  ["over_request_rate_limit", TOO_MANY_ATTEMPTS],
  ["over_email_send_rate_limit", TOO_MANY_ATTEMPTS],
  [
    "email_not_confirmed",
    "Your email is not confirmed yet. Open the link in your confirmation email, then sign in.",
  ],
  ["network", "Ki-Lo could not reach the server. Check your connection and try again."],
]);

/**
 * A fixed sentence for the Supabase auth failures a user can hit: wrong credentials, an account
 * that exists, rate limits, an unconfirmed email and a network failure. Any other code, or none,
 * gets the generic sentence. The server's message is never shown.
 */
export const describeAuthError = (code: string | undefined): string =>
  (code === undefined ? undefined : AUTH_ERROR_SENTENCES.get(code)) ?? GENERIC_ERROR;
