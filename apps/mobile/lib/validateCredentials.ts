import { AUTH_FIELD_PROBLEMS } from "@keylow/core/copy";

export type Credentials = {
  email: string;
  password: string;
};

// Sign-in only needs a password to be present, since the server's own minimum length may be lower than the sign-up rule.
export type PasswordRule = "required" | "minLength";

export type CredentialErrors = {
  email?: string;
  password?: string;
};

const minimumPasswordLength = 8;
const wellFormedEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateCredentials(
  { email, password }: Credentials,
  passwordRule: PasswordRule,
): CredentialErrors {
  const errors: CredentialErrors = {};

  if (email.trim() === "") {
    errors.email = AUTH_FIELD_PROBLEMS.emailRequired;
  } else if (!wellFormedEmail.test(email.trim())) {
    errors.email = AUTH_FIELD_PROBLEMS.emailInvalid;
  }

  if (passwordRule === "required" && password === "") {
    errors.password = AUTH_FIELD_PROBLEMS.passwordRequired;
  } else if (passwordRule === "minLength" && password.length < minimumPasswordLength) {
    errors.password = AUTH_FIELD_PROBLEMS.passwordTooShort;
  }

  return errors;
}
