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
    errors.email = "Enter your email address";
  } else if (!wellFormedEmail.test(email.trim())) {
    errors.email = "Enter a valid email address";
  }

  if (passwordRule === "required" && password === "") {
    errors.password = "Enter your password";
  } else if (passwordRule === "minLength" && password.length < minimumPasswordLength) {
    errors.password = `Password must be at least ${String(minimumPasswordLength)} characters`;
  }

  return errors;
}
