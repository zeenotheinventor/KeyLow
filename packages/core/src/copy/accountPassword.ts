import { PASSWORD_HELPER } from "./auth";

/** Where the words point: the phone app or the web app. The web says "browser" where the phone says "phone". */
export type ResetLinkDevice = "phone" | "browser";

/** The link under the password field on the sign in screen. */
export const FORGOT_PASSWORD_LINK = "Forgot password?";

/** What the screen that asks for the email address says. */
export const FORGOT_PASSWORD_SCREEN = {
  heading: "Reset your password",
  body: "Enter the email you use for Ki-Lo. Ki-Lo will send a link to set a new password.",
  submitLabel: "Send link",
  submittingLabel: "Sending link",
  footerPrompt: "Remembered it?",
  footerLink: "Sign in",
};

/**
 * What the Forgot password screen says in place of its Sign in words when it is reached signed in, from Delete
 * account: the header's Back, and the sent message's way back. The "Remembered it? Sign in" line is not drawn then.
 */
export const FORGOT_PASSWORD_FROM_DELETE_ACCOUNT = {
  backLabel: "Back",
  sentBackLabel: "Back to Delete account",
};

/** What the screen says once a reset link has been requested. `describeResetLinkSent` is its body. */
export const RESET_LINK_SENT_SCREEN = {
  heading: "Check your email",
  backToSignInLabel: "Back to sign in",
  spamHint: "No email? Check your spam folder, or send it again.",
  sendAgainLabel: "Send again",
};

/**
 * The sentence on the link sent screen. It never says an account exists, because the same screen shows for an
 * address with no account. The email is the person's own, so it is never logged.
 */
export const describeResetLinkSent = (email: string, device: ResetLinkDevice): string =>
  `If ${email} has a Ki-Lo account, a link to set a new password is on its way. Open it ${
    device === "phone" ? "on this phone" : "in this browser"
  }. It works once, for one hour.`;

/** The label of Send again while it is locked, counting down the seconds left. */
export const describeSendAgainCountdown = (seconds: number): string => `Send again in ${seconds} s`;

/** What the screen says when a reset link failed. `describeResetLinkInvalid` is its body. */
export const RESET_LINK_INVALID = {
  title: "Reset link not valid",
  sendNewLinkLabel: "Send a new link",
  backToSignInLabel: "Back to sign in",
};

export const describeResetLinkInvalid = (device: ResetLinkDevice): string =>
  `This link has expired or was already used. A link works once, for one hour, ${
    device === "phone" ? "on the phone" : "in the browser"
  } where you asked for it.`;

/** What the screen that sets a new password after a reset link says. */
export const SET_PASSWORD_SCREEN = {
  heading: "Set a new password",
  newPasswordLabel: "New password",
  confirmPasswordLabel: "Confirm new password",
  helper: PASSWORD_HELPER,
  submitLabel: "Save password",
  submittingLabel: "Saving password",
};

export const describePasswordFor = (email: string): string =>
  `For ${email}. Other devices will be signed out.`;

/** What the screen says after a reset saved the new password. */
export const PASSWORD_SAVED = {
  title: "Password saved",
  body: "You are signed in. Use your new password next time. Other devices have been signed out.",
  continueLabel: "Continue",
};

/** The Change password row in settings and the screen it opens. */
export const CHANGE_PASSWORD_SCREEN = {
  rowLabel: "Change password",
  heading: "Change password",
  newPasswordLabel: "New password",
  confirmPasswordLabel: "Confirm new password",
  submitLabel: "Save password",
  submittingLabel: "Saving password",
};

/** What the screen says after a signed in person changed their password. */
export const PASSWORD_CHANGED = {
  title: "Password changed",
  body: "Use your new password next time you sign in. Other devices have been signed out.",
  doneLabel: "Done",
};

/**
 * The problems the new password forms show. `weakPassword` and `changeSessionEnded` are proposed: the
 * boards do not carry them yet, so they may change after the design review.
 */
export const PASSWORD_PROBLEMS = {
  mismatch: "The passwords do not match",
  samePassword: "That is your current password. Choose a new one.",
  resetTimedOut: "This reset has timed out. Ask for a new link.",
  weakPassword: "Choose a stronger password. This one is too easy to guess.",
  changeSessionEnded: "You have been signed out. Sign in again, then change your password.",
};
