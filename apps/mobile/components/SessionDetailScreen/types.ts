import type { SessionOrigin } from "@keylow/core/copy";

export type SessionDetailScreenProps = {
  /** The session's id, from the address. Undefined or one that is not a session of the person reads as not found. */
  id: string | undefined;
  /** The screen the session was opened from, which the Back control is named for. */
  origin: SessionOrigin;
  /** The header's Back: goes back to the screen before this one. */
  onBack: () => void;
  /** Goes to the history list: the way out of a session that is not found. */
  onOpenHistory: () => void;
};
