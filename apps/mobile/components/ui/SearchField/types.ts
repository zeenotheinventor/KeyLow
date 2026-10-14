import type { ReactNode } from "react";

export type SearchFieldProps = {
  /** The field's accessible name, such as "Search foods". */
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  /** Called when the keyboard's search key is pressed. */
  onSubmitEditing?: () => void;
  /** Opens the keyboard when the field appears. */
  autoFocus?: boolean;
  /**
   * A control that empties the field, drawn while the field has text. The boards draw none, so a
   * screen only gets one by passing it. Its `label` is what a screen reader says.
   */
  clear?: { label: string; onPress: () => void } | undefined;
  /** The slot at the trailing edge, for the scan control: a ghost `IconButton`. */
  trailing?: ReactNode;
};
