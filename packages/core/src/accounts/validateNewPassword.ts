import { AUTH_FIELD_PROBLEMS, PASSWORD_PROBLEMS } from "../copy";

export const PASSWORD_MIN_LENGTH = 8;

export type NewPasswordProblems = { password?: string; confirmation?: string };

/**
 * The problems with the two password fields. The length counts code points, so an emoji counts once, and
 * nothing is trimmed because a password may hold spaces. The two problems are independent, because the
 * form shows both at once.
 */
export function validateNewPassword({
  password,
  confirmation,
}: {
  password: string;
  confirmation: string;
}): NewPasswordProblems {
  const problems: NewPasswordProblems = {};

  if (Array.from(password).length < PASSWORD_MIN_LENGTH) {
    problems.password = AUTH_FIELD_PROBLEMS.passwordTooShort;
  }

  if (confirmation !== password) {
    problems.confirmation = PASSWORD_PROBLEMS.mismatch;
  }

  return problems;
}
