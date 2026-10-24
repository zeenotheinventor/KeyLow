/**
 * How the wizard was opened. `first-run` is a new account's setup, and `recalculate` is an existing
 * account's, opened from Targets, which adds Close to every step.
 */
export type SetupMode = "first-run" | "recalculate";

export type SetupScreenProps = {
  mode: SetupMode;
};
