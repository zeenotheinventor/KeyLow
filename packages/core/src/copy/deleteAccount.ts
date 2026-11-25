import { COMPANY_DETAILS } from "./legal";

/**
 * The words of Delete account (KEY-1117): the More row, the screen, its confirm step, the two ways an attempt
 * can end without a deletion, and the Sign in confirmation, as the `delete-account` boards and `sign-in ·
 * account-deleted` print them. The email action's label comes from `describeDeleteAccountEmailAction`.
 */
export const DELETE_ACCOUNT_COPY = {
  moreRow: {
    title: "Delete account",
  },
  title: "Delete account",
  back: "Back to More",
  card: {
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
  },
  permanence: "Your account is deleted at once. This cannot be undone.",
  exportRow: {
    title: "Export my data",
    subtitle: "Save a copy first",
  },
  buttons: {
    delete: "Delete account",
    keep: "Keep my account",
    retry: "Try again",
    backToMore: "Back to More",
  },
  offline: {
    title: "You're offline",
    body: "Deleting your account needs a connection.",
  },
  dialog: {
    title: "Delete your account?",
    body: "Everything in your account is deleted now. This cannot be undone.",
    confirmLabel: "Delete account",
    cancelLabel: "Keep my account",
    deleting: {
      title: "Deleting your account",
      body: "This can take a moment. Keep Ki-Lo open.",
      spinnerLabel: "Deleting your account",
    },
  },
  failed: {
    title: "Your account was not deleted",
    body: "Nothing was removed. Try again or use email.",
  },
  unconfirmed: {
    title: "Ki-Lo could not confirm the deletion",
    body: "Your account may already be deleted. Check your connection and try again.",
  },
  signInNotice: "Your account has been deleted.",
} as const;

/** The failed board's banner action, built from the address the Terms give: "Email hello@sojisoft.com". */
export const describeDeleteAccountEmailAction = (): string =>
  `Email ${COMPANY_DETAILS.contactEmail}`;
