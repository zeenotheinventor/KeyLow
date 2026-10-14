import { TextField } from "./TextField";

import type { InputProps } from "./types";

/** A single line of text with its label, a helper or an error under it, and a locked state for a value that cannot change. */
export function Input(props: InputProps) {
  return <TextField {...props} />;
}
