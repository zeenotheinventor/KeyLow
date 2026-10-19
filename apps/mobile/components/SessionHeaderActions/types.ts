export type SessionHeaderActionsProps = {
  /** Opens the session's menu. The control is drawn only when this is given. */
  onMore?: (() => void) | undefined;
  /** Opens the finish screen. The button is drawn only when this is given. */
  onFinish?: (() => void) | undefined;
  /** Dims Finish and stops it responding, for a session with no set logged. Defaults to false. */
  isFinishDisabled?: boolean | undefined;
};
