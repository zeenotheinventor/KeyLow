import { AUTH_FIELD_PROBLEMS, describeAuthError } from "@keylow/core/copy";
import { isAuthRetryableFetchError, type AuthError } from "@supabase/supabase-js";

export const PASSWORD_MIN_LENGTH = 8;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type FieldErrors = {
  email?: string;
  password?: string;
};

/**
 * Checks the two fields. Sign-in only needs a password, because accounts made under a shorter
 * minimum must still work. Sign-up holds the password to the minimum.
 */
export function validateCredentials(
  email: string,
  password: string,
  { enforcePasswordLength }: { enforcePasswordLength: boolean },
): FieldErrors {
  const errors: FieldErrors = {};

  if (email === "") {
    errors.email = AUTH_FIELD_PROBLEMS.emailRequired;
  } else if (!EMAIL_PATTERN.test(email)) {
    errors.email = AUTH_FIELD_PROBLEMS.emailInvalid;
  }

  if (password === "") {
    errors.password = AUTH_FIELD_PROBLEMS.passwordRequired;
  } else if (enforcePasswordLength && password.length < PASSWORD_MIN_LENGTH) {
    errors.password = AUTH_FIELD_PROBLEMS.passwordTooShort;
  }

  return errors;
}

export const hasFieldErrors = (errors: FieldErrors) =>
  errors.email !== undefined || errors.password !== undefined;

// The server's message is never shown. A failed fetch has no code, so it is named for the copy.
export function describeFailure(error: AuthError): string {
  return describeAuthError(isAuthRetryableFetchError(error) ? "network" : error.code);
}
