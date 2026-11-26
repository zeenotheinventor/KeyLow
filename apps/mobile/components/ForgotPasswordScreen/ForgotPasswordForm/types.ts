export type ForgotPasswordFormProps = {
  email: string;
  onChangeEmail: (email: string) => void;
  /** The problem with the address, drawn as the field's own error. */
  fieldError: string | undefined;
  /** What went wrong with the request, drawn as an error banner above the button. */
  failure: string | undefined;
  isSending: boolean;
  onSend: () => void;
  /** The header chevron's name. */
  backLabel: string;
  /** Whether the Sign in line is drawn under the button, which only a signed out person needs. */
  hasSignInFooter: boolean;
  onBackToSignIn: () => void;
};
