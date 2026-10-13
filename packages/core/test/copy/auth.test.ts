import { describe, expect, it } from "vitest";

import {
  AUTH_FIELD_PROBLEMS,
  CHECK_EMAIL_TITLE,
  GENERIC_ERROR,
  PASSWORD_HELPER,
  SIGN_IN_LINK_INVALID,
  SIGN_IN_LINK_NOT_VERIFIED,
  SIGN_IN_REFUSED,
  describeAuthError,
  describeCheckEmail,
} from "../../src/copy";

describe("drawn auth sentences", () => {
  it("should pin the refused sign in", () => {
    expect(SIGN_IN_REFUSED).toBe("Email or password is not right. Check them and try again.");
  });

  it("should pin the bad sign in link on web", () => {
    expect(SIGN_IN_LINK_NOT_VERIFIED).toBe(
      "That sign-in link could not be verified. Sign in again, or request a new link.",
    );
  });

  it("should pin the bad sign in link on mobile", () => {
    expect(SIGN_IN_LINK_INVALID).toEqual({
      title: "Link not valid",
      body: "This sign-in link is not valid. It may have expired or already been used.",
    });
  });

  it("should pin the generic sentence", () => {
    expect(GENERIC_ERROR).toBe("Something went wrong. Try again.");
  });

  it("should pin the sign up password helper", () => {
    expect(PASSWORD_HELPER).toBe("At least 8 characters");
  });

  it("should pin the field problems", () => {
    expect(AUTH_FIELD_PROBLEMS).toEqual({
      emailRequired: "Enter your email address",
      emailInvalid: "Enter a valid email address",
      passwordRequired: "Enter your password",
      passwordTooShort: "Password must be at least 8 characters",
    });
  });
});

describe("check your email notice", () => {
  it("should pin the title", () => {
    expect(CHECK_EMAIL_TITLE).toBe("Check your email");
  });

  it("should name the address the link was sent to", () => {
    expect(describeCheckEmail("sam.taylor@example.com")).toBe(
      "Open the confirmation link sent to sam.taylor@example.com to finish creating your account.",
    );
  });
});

describe("describeAuthError", () => {
  it("should say the credentials are wrong for invalid_credentials", () => {
    expect(describeAuthError("invalid_credentials")).toBe(SIGN_IN_REFUSED);
  });

  it.each(["user_already_exists", "email_exists"])(
    "should say the account exists for %s",
    (code) => {
      expect(describeAuthError(code)).toBe(
        "An account with this email already exists. Sign in instead.",
      );
    },
  );

  it.each(["over_request_rate_limit", "over_email_send_rate_limit"])(
    "should say there were too many attempts for %s",
    (code) => {
      expect(describeAuthError(code)).toBe(
        "Too many attempts. Wait a few minutes, then try again.",
      );
    },
  );

  it("should say the email is not confirmed for email_not_confirmed", () => {
    expect(describeAuthError("email_not_confirmed")).toBe(
      "Your email is not confirmed yet. Open the link in your confirmation email, then sign in.",
    );
  });

  it("should say the connection failed for a network failure", () => {
    expect(describeAuthError("network")).toBe(
      "Ki-Lo could not reach the server. Check your connection and try again.",
    );
  });

  it.each([
    undefined,
    "",
    "unexpected_failure",
    "something_new_the_server_added",
    "constructor",
    "__proto__",
    "toString",
  ])("should give the generic sentence for the unknown code %s", (code) => {
    expect(describeAuthError(code)).toBe(GENERIC_ERROR);
  });

  it("should never show a raw code", () => {
    const codes = [
      "invalid_credentials",
      "user_already_exists",
      "email_exists",
      "over_request_rate_limit",
      "over_email_send_rate_limit",
      "email_not_confirmed",
      "network",
    ];
    for (const code of codes) {
      expect(describeAuthError(code)).not.toContain(code);
    }
  });
});
