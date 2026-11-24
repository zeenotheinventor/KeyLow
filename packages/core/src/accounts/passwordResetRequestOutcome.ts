import { AUTH_FIELD_PROBLEMS, describeAuthError } from "../copy";

export type PasswordResetRequestOutcome =
  | { kind: "sent"; unexpectedCode?: string }
  | { kind: "invalidEmail"; message: string }
  | { kind: "failed"; message: string };

/**
 * What a reset request's answer means to the person. `code` is undefined for a success, or the Supabase
 * error code ("network" for a failed fetch).
 *
 * This must never tell a known address from an unknown one. GoTrue answers 200 for an unknown address and
 * sends no mail for it, so anything that only happens when mail is actually sent (the 60 second window's
 * `over_email_send_rate_limit`, the project's email quota, `email_address_not_authorized`, an SMTP failure)
 * only happens for a known address. Showing it would reveal the account. So only the codes that are the
 * same for every address get a message, and any other code reads as sent. `unexpectedCode` lets an app
 * report the code, and only the code, to Sentry. Never the address.
 *
 * Known cost, accepted: when the email quota is exhausted a real person sees "Check your email" and
 * nothing arrives. Send again after 60 seconds is the remedy. The sign up rate limit sentence in
 * `describeAuthError` must never apply here, which is why `over_email_send_rate_limit` is not looked up.
 */
export function passwordResetRequestOutcome(code: string | undefined): PasswordResetRequestOutcome {
  switch (code) {
    case undefined:
    case "user_not_found":
    case "over_email_send_rate_limit":
      return { kind: "sent" };
    case "email_address_invalid":
    case "validation_failed":
      return { kind: "invalidEmail", message: AUTH_FIELD_PROBLEMS.emailInvalid };
    case "network":
    case "over_request_rate_limit":
      return { kind: "failed", message: describeAuthError(code) };
    default:
      return { kind: "sent", unexpectedCode: code };
  }
}
