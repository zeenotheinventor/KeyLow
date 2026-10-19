import type { Ref } from "react";
import type { TextInput, TextInputProps } from "react-native";

export type FieldTextInputProps = TextInputProps & {
  /** The text input itself, so a screen can move focus to it. */
  ref?: Ref<TextInput> | undefined;
};
