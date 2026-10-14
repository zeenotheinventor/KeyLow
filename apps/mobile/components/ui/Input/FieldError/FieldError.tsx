import { Text as NativeText } from "react-native";

import type { FieldErrorProps } from "./types";

// The error is danger text in both schemes, as the boards draw it. The kit's Text has no danger tone,
// because a status colour is not text in light anywhere the boards do not say so.
const errorClassName = "text-caption font-medium tabular-nums text-danger";

/**
 * A field's error message: a danger caption that is an alert. A field draws it under itself, and a screen
 * that places the message itself, with `errorShownElsewhere`, draws this too, so there is one look. The
 * alert role alone does not announce on mount on Android, so a failure is a live region too.
 */
export function FieldError({ children, className = "" }: FieldErrorProps) {
  return (
    <NativeText aria-live="assertive" className={`${errorClassName} ${className}`} role="alert">
      {children}
    </NativeText>
  );
}
