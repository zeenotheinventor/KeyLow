import { TextField } from "../Input";

import type { NumericInputProps } from "./types";

/** The Input with its digits right aligned and tabular, the decimal keyboard, and a unit after the value. */
export function NumericInput({
  placeholder = "0",
  density = "compact",
  align = "right",
  keyboardType = "decimal-pad",
  ...props
}: NumericInputProps) {
  return (
    <TextField
      {...props}
      density={density}
      align={align}
      keyboardType={keyboardType}
      placeholder={placeholder}
    />
  );
}
