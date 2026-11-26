import { describe, expect, it } from "vitest";

import {
  CHANGE_PASSWORD_SCREEN,
  FORGOT_PASSWORD_FROM_DELETE_ACCOUNT,
  FORGOT_PASSWORD_LINK,
  FORGOT_PASSWORD_SCREEN,
  PASSWORD_CHANGED,
  PASSWORD_HELPER,
  PASSWORD_PROBLEMS,
  PASSWORD_SAVED,
  RESET_LINK_INVALID,
  RESET_LINK_SENT_SCREEN,
  SET_PASSWORD_SCREEN,
  describePasswordFor,
  describeResetLinkInvalid,
  describeResetLinkSent,
  describeSendAgainCountdown,
} from "../../src/copy";

const email = `${crypto.randomUUID()}@keylow.test`;

describe("the forgot password sentences", () => {
  it("should pin the link on the sign in screen", () => {
    expect(FORGOT_PASSWORD_LINK).toBe("Forgot password?");
  });

  it("should pin the words of the screen when it is reached from Delete account", () => {
    expect(FORGOT_PASSWORD_FROM_DELETE_ACCOUNT).toEqual({
      backLabel: "Back",
      sentBackLabel: "Back to Delete account",
    });
  });

  it("should pin the request screen", () => {
    expect(FORGOT_PASSWORD_SCREEN).toEqual({
      heading: "Reset your password",
      body: "Enter the email you use for Ki-Lo. Ki-Lo will send a link to set a new password.",
      submitLabel: "Send link",
      submittingLabel: "Sending link",
      footerPrompt: "Remembered it?",
      footerLink: "Sign in",
    });
  });
});

describe("the link sent sentences", () => {
  it("should pin the screen", () => {
    expect(RESET_LINK_SENT_SCREEN).toEqual({
      heading: "Check your email",
      backToSignInLabel: "Back to sign in",
      spamHint: "No email? Check your spam folder, or send it again.",
      sendAgainLabel: "Send again",
    });
  });

  it("should say the link opens on this phone", () => {
    expect(describeResetLinkSent(email, "phone")).toBe(
      `If ${email} has a Ki-Lo account, a link to set a new password is on its way. Open it on this phone. It works once, for one hour.`,
    );
  });

  it("should say the link opens in this browser on the web", () => {
    expect(describeResetLinkSent(email, "browser")).toBe(
      `If ${email} has a Ki-Lo account, a link to set a new password is on its way. Open it in this browser. It works once, for one hour.`,
    );
  });

  it("should count the seconds before Send again unlocks", () => {
    expect(describeSendAgainCountdown(42)).toBe("Send again in 42 s");
  });
});

describe("the link not valid sentences", () => {
  it("should pin the screen", () => {
    expect(RESET_LINK_INVALID).toEqual({
      title: "Reset link not valid",
      sendNewLinkLabel: "Send a new link",
      backToSignInLabel: "Back to sign in",
    });
  });

  it("should name the phone where the link was asked for", () => {
    expect(describeResetLinkInvalid("phone")).toBe(
      "This link has expired or was already used. A link works once, for one hour, on the phone where you asked for it.",
    );
  });

  it("should name the browser where the link was asked for", () => {
    expect(describeResetLinkInvalid("browser")).toBe(
      "This link has expired or was already used. A link works once, for one hour, in the browser where you asked for it.",
    );
  });
});

describe("the new password sentences", () => {
  it("should pin the set password screen and reuse the shared helper", () => {
    expect(SET_PASSWORD_SCREEN).toEqual({
      heading: "Set a new password",
      newPasswordLabel: "New password",
      confirmPasswordLabel: "Confirm new password",
      helper: PASSWORD_HELPER,
      submitLabel: "Save password",
      submittingLabel: "Saving password",
    });
  });

  it("should say which account the password is for", () => {
    expect(describePasswordFor(email)).toBe(`For ${email}. Other devices will be signed out.`);
  });

  it("should pin the saved screen", () => {
    expect(PASSWORD_SAVED).toEqual({
      title: "Password saved",
      body: "You are signed in. Use your new password next time. Other devices have been signed out.",
      continueLabel: "Continue",
    });
  });

  it("should pin the change password screen", () => {
    expect(CHANGE_PASSWORD_SCREEN).toEqual({
      rowLabel: "Change password",
      heading: "Change password",
      newPasswordLabel: "New password",
      confirmPasswordLabel: "Confirm new password",
      submitLabel: "Save password",
      submittingLabel: "Saving password",
    });
  });

  it("should pin the changed screen", () => {
    expect(PASSWORD_CHANGED).toEqual({
      title: "Password changed",
      body: "Use your new password next time you sign in. Other devices have been signed out.",
      doneLabel: "Done",
    });
  });
});

describe("the password problems", () => {
  it("should pin every problem", () => {
    expect(PASSWORD_PROBLEMS).toEqual({
      mismatch: "The passwords do not match",
      samePassword: "That is your current password. Choose a new one.",
      resetTimedOut: "This reset has timed out. Ask for a new link.",
      weakPassword: "Choose a stronger password. This one is too easy to guess.",
      changeSessionEnded: "You have been signed out. Sign in again, then change your password.",
    });
  });
});
