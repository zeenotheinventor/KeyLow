import { iconStroke } from "@keylow/tokens";
import * as React from "react";

import type { FieldProps, TextFieldProps } from "./types";

import { cn } from "@/lib/utils";

// The design's input is a box: 44 high, raised surface, medium radius. Focus turns the border to the
// accent, which is the whole indicator in dark. The light accent border is under 3:1 against the
// page, so light also adds the ring. An invalid field keeps its danger border while focused, so the
// accent border only applies to a field that is not invalid. An invalid field has no border change to
// show focus, so it keeps the ring in both themes.
const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-control-md w-full rounded-medium border border-border bg-surface-raised px-4 text-body text-text-primary outline-none transition-[border-color,box-shadow] duration-quick placeholder:text-text-muted light-theme:focus-visible:ring-2 focus-visible:ring-focus-ring light-theme:focus-visible:ring-offset-2 focus-visible:ring-offset-focus-ring-offset focus-visible:[&:not([aria-invalid=true])]:border-accent aria-[invalid=true]:border-danger aria-[invalid=true]:focus-visible:ring-2 aria-[invalid=true]:focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-surface disabled:opacity-50",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

// A label, a control, and a helper or an error. The control is named by the label and described by
// whichever message is showing. `TextField` and `NumericInput` both draw their control inside it.
function Field({
  id,
  label,
  helper,
  error,
  labelHint,
  invalid,
  describedBy: extraDescribedBy,
  disabled,
  hideLabel,
  children,
}: FieldProps) {
  const generatedId = React.useId();
  const fieldId = id ?? generatedId;
  const messageId = `${fieldId}-message`;
  const hintId = `${fieldId}-hint`;
  // An empty error is no error, so it neither flags the field nor puts an empty alert on the page.
  const errorText = error?.trim() === "" ? undefined : error;
  const message = errorText ?? helper;
  // An empty hint is no hint, as an empty error is no error.
  const hint = labelHint?.trim() === "" ? undefined : labelHint;
  const mutedWhenDisabled = disabled === true && "opacity-50";
  // The hint is read first, then whichever message is showing, then anything the screen points at.
  const describedBy = [
    hint === undefined ? undefined : hintId,
    message === undefined ? undefined : messageId,
    extraDescribedBy,
  ]
    .filter((identifier) => identifier !== undefined)
    .join(" ");

  const labelElement = (
    <label
      htmlFor={fieldId}
      className={cn(
        "flex items-center gap-1.5 text-caption text-text-secondary",
        hideLabel === true && "sr-only",
        mutedWhenDisabled,
      )}
    >
      {label}
    </label>
  );

  return (
    <div className="flex flex-col gap-1">
      {hint === undefined ? (
        labelElement
      ) : (
        <div className="flex justify-between gap-1">
          {labelElement}
          <span id={hintId} className={cn("text-caption text-text-muted", mutedWhenDisabled)}>
            {hint}
          </span>
        </div>
      )}
      {children({
        id: fieldId,
        "aria-invalid": errorText !== undefined || invalid === true,
        "aria-describedby": describedBy === "" ? undefined : describedBy,
      })}
      {message !== undefined && (
        <span
          // The key remounts the message when an error replaces the helper, so the alert is announced.
          key={errorText === undefined ? "helper" : "error"}
          id={messageId}
          role={errorText === undefined ? undefined : "alert"}
          className={cn(
            "text-caption",
            errorText === undefined ? "text-text-muted" : "text-danger",
            mutedWhenDisabled,
          )}
        >
          {message}
        </span>
      )}
    </div>
  );
}

function TextField({
  id,
  label,
  helper,
  error,
  labelHint,
  invalid,
  describedBy,
  trailingIcon: TrailingIcon,
  disabled,
  className,
  ...inputProps
}: TextFieldProps) {
  return (
    <Field
      id={id}
      label={label}
      helper={helper}
      error={error}
      labelHint={labelHint}
      invalid={invalid}
      describedBy={describedBy}
      disabled={disabled}
    >
      {(control) =>
        TrailingIcon === undefined ? (
          <Input disabled={disabled} className={className} {...control} {...inputProps} />
        ) : (
          <div className="relative">
            <Input
              disabled={disabled}
              className={cn(className, "pr-9")}
              {...control}
              {...inputProps}
            />
            <TrailingIcon
              aria-hidden
              strokeWidth={iconStroke}
              className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-text-muted"
            />
          </div>
        )
      }
    </Field>
  );
}

export { Field, Input, TextField };
