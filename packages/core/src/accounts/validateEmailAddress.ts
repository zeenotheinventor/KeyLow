import { AUTH_FIELD_PROBLEMS } from "../copy";

// The pattern both apps use for the sign in and sign up forms.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The problem with an email address, or undefined when it is fine. The address is trimmed first. */
export function validateEmailAddress(email: string): string | undefined {
  const trimmed = email.trim();

  if (trimmed === "") {
    return AUTH_FIELD_PROBLEMS.emailRequired;
  }

  return EMAIL_PATTERN.test(trimmed) ? undefined : AUTH_FIELD_PROBLEMS.emailInvalid;
}
