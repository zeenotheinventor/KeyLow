import type { ProgressSet } from "@keylow/core/training";

export type SessionMenuProps = {
  /** Whether the menu behind the header's More control is open. The screen owns it, since the control is in its header. */
  open: boolean;
  /** Called when the user dismisses the menu. The screen then sets `open` to false. */
  onClose: () => void;
  sessionId: string;
  /** The routine day's name, or null for a session that follows none. */
  dayName: string | null;
  /** The session's logged sets, those still being saved included, which the discard sheet counts. */
  sets: readonly ProgressSet[];
  /** Called once the session is deleted: the screen goes on to the tabs. */
  onDiscarded: () => void;
};
