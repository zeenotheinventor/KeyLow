export type ComposerProps = {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  /** Dims Send and stops it responding: while an answer arrives, while the field is empty and while offline. */
  isSendDisabled: boolean;
  /** Dims the whole field and stops it taking typing, as the offline board draws it. */
  isFieldDisabled: boolean;
  placeholder: string;
  /** Puts the cursor in the field as the sheet opens, as Describe does. */
  isAutoFocused?: boolean | undefined;
};
