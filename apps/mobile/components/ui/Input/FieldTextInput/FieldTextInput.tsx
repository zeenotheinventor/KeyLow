import { useContext } from "react";
import { TextInput } from "react-native";

import { IsInsideSheetContext, SheetTextInput } from "../../BottomSheet";

import type { FieldTextInputProps } from "./types";
import type { ComponentProps } from "react";

/**
 * The text input of a single line field. Inside a bottom sheet it is the library's own input, which
 * reports its focus to the sheet, so the sheet is lifted above the keyboard; anywhere else it is the plain
 * input.
 */
export function FieldTextInput({ ref, ...props }: FieldTextInputProps) {
  const isInsideSheet = useContext(IsInsideSheetContext);

  // Gorhom types its input's ref as holding a `TextInput | undefined`, the gesture handler's own class, which
  // a ref to the plain input does not fit. Both are the one native text input, so the ref is handed on as
  // Gorhom's type.
  return isInsideSheet ? (
    <SheetTextInput {...props} ref={ref as ComponentProps<typeof SheetTextInput>["ref"]} />
  ) : (
    <TextInput {...props} ref={ref} />
  );
}
