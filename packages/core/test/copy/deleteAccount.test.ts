import { describe, expect, it } from "vitest";

import {
  COMPANY_DETAILS,
  DELETE_ACCOUNT_COPY,
  describeDeleteAccountEmailAction,
} from "../../src/copy";

describe("DELETE_ACCOUNT_COPY", () => {
  it("should word the More row, the screen and its card as the explain board prints them", () => {
    expect(DELETE_ACCOUNT_COPY.moreRow).toEqual({ title: "Delete account" });
    expect(DELETE_ACCOUNT_COPY.title).toBe("Delete account");
    expect(DELETE_ACCOUNT_COPY.back).toBe("Back to More");
    expect(DELETE_ACCOUNT_COPY.card).toEqual({
      title: "What Ki-Lo deletes",
      items: [
        "Your diary",
        "Your own foods and recipes",
        "Your weight and body measurements",
        "Your programme and targets",
        "Your training",
        "Your assistant conversations",
        "Your achievements",
        "What Ki-Lo keeps on this phone",
      ],
      caption:
        "Error reports and what the assistant sent to Anthropic can stay with those services for up to 30 days.",
    });
    expect(DELETE_ACCOUNT_COPY.permanence).toBe(
      "Your account is deleted at once. This cannot be undone.",
    );
    expect(DELETE_ACCOUNT_COPY.exportRow).toEqual({
      title: "Export my data",
      subtitle: "Save a copy first",
    });
    expect(DELETE_ACCOUNT_COPY.buttons).toEqual({
      delete: "Delete account",
      keep: "Keep my account",
      retry: "Try again",
      backToMore: "Back to More",
    });
  });

  it("should word the offline banner as explain-offline prints it", () => {
    expect(DELETE_ACCOUNT_COPY.offline).toEqual({
      title: "You're offline",
      body: "Deleting your account needs a connection.",
    });
  });

  it("should word the dialog as confirm, confirm-password, confirm-password-wrong and deleting print it", () => {
    expect(DELETE_ACCOUNT_COPY.dialog).toEqual({
      title: "Delete your account?",
      body: "Everything in your account is deleted now. This cannot be undone.",
      confirmLabel: "Delete account",
      cancelLabel: "Keep my account",
      password: {
        body: "Everything in your account is deleted now. This cannot be undone. Enter your password to confirm.",
        wrongPassword: "That password is not right. Nothing was deleted.",
      },
      deleting: {
        title: "Deleting your account",
        body: "This can take a moment. Keep Ki-Lo open.",
        spinnerLabel: "Deleting your account",
      },
    });
  });

  it("should word failed and unconfirmed as their boards print them", () => {
    expect(DELETE_ACCOUNT_COPY.failed).toEqual({
      title: "Your account was not deleted",
      body: "Nothing was removed. Try again or use email.",
    });
    expect(DELETE_ACCOUNT_COPY.unconfirmed).toEqual({
      title: "Ki-Lo could not confirm the deletion",
      body: "Your account may already be deleted. Check your connection and try again.",
    });
  });

  it("should word the Sign in confirmation as sign-in account-deleted prints it", () => {
    expect(DELETE_ACCOUNT_COPY.signInNotice).toBe("Your account has been deleted.");
  });
});

describe("describeDeleteAccountEmailAction", () => {
  it("should hold the contact address the Terms give, so the two always match", () => {
    expect(describeDeleteAccountEmailAction()).toContain(COMPANY_DETAILS.contactEmail);
  });

  it("should word the banner action as the failed board prints it", () => {
    expect(describeDeleteAccountEmailAction()).toBe("Email hello@sojisoft.com");
  });
});
