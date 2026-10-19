export type SessionDetailMenuProps = {
  open: boolean;
  onClose: () => void;
  /** The session shown. Its day, date and sets are read from it for the question. */
  sessionId: string;
  /** Called once the session is deleted: the screen goes back to the history list. */
  onDeleted: () => void;
  /**
   * Called with true as the delete starts and false if it fails. The session leaves the cache the moment it
   * is deleted, so the screen holds what it shows while it leaves.
   */
  onDeleting: (isDeleting: boolean) => void;
};
