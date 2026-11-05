import type { SessionOrigin } from "@keylow/core/copy";

export type SessionDetailScreenProps = {
  /** The session's id, from the address. One that is not a session of the person reads as not found. */
  id: string;
  /** The screen the session was opened from, which the Back link is named for and goes to. */
  origin: SessionOrigin;
};
