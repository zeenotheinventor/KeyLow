export type LoginFormProps = {
  linkError?: string | undefined;
};

export type FieldErrors = {
  email?: string;
  password?: string;
};

/** Which request is running, so its button shows the spinner and the others wait. */
export type PendingAction = "signIn" | "signUp" | "google";
