export type AssistantComposerProps = {
  value: string;
  onChange: (value: string) => void;
  /** Called on Enter, and on the Send button. Shift and Enter add a line instead. */
  onSend: () => void;
  isSendDisabled: boolean;
  isFieldDisabled: boolean;
  placeholder: string;
  /** The line over the field, from Describe only: the chip that says the time the meal logs at, and a few words. */
  hint?: { chip: string; text: string } | undefined;
  /** Focus goes to the field when the panel opens, so the panel holds a ref to it. */
  fieldRef: React.Ref<HTMLTextAreaElement>;
};
