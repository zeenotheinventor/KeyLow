export type CameraPermissionPromptProps = {
  /** False once the system will not show its prompt again, which leaves the settings app. */
  canAskAgain: boolean;
  onAllowCamera: () => void;
  onOpenSettings: () => void;
};
