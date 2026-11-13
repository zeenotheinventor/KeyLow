export type AssistantComposerProps = {
  value: string;
  onChange: (value: string) => void;
  /** Called on Enter, and on the Send button. Shift and Enter add a line instead. */
  onSend: () => void;
  isSendDisabled: boolean;
  isFieldDisabled: boolean;
  placeholder: string;
  /** Focus goes to the field when the panel opens, so the panel holds a ref to it. */
  fieldRef: React.Ref<HTMLTextAreaElement>;
};
