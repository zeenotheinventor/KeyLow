export type LoginFormProps = {
  linkError?: string | undefined;
};

/** Which request is running, so its button shows the spinner and the other waits. */
export type PendingAction = "signIn" | "google";
