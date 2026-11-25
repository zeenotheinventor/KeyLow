import type { ReactNode } from "react";

/**
 * What the form is for. `recovery` is the screen after a reset link: when the password is saved the screen
 * takes over, and a session that has ended offers a new link. `change` is the screen a signed in person opens
 * from More: when the password is saved the form shows the saved notice and Done, and a session that has
 * ended only says so.
 */
export type NewPasswordFormProps = (
  | {
      context: "recovery";
      /** Called once the password is saved, so the screen can say so. */
      onSaved: () => void;
      /** Called from the Send a new link action, when the reset has timed out. */
      onSendNewLink: () => void;
    }
  | {
      context: "change";
      /** Called from Done, once the password is saved. */
      onDone: () => void;
    }
) & {
  /** What the screen draws above the fields, its heading and caption. */
  children?: ReactNode;
};
