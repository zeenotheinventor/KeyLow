import * as React from "react";

import { cn } from "@/lib/utils";

// The design's input is a box: 44 high, raised surface, medium radius. Focus turns the border to the
// accent and adds the ring. An invalid field keeps its danger border while focused, so the accent
// border only applies to a field that is not invalid.
const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-[44px] w-full rounded-medium border border-border bg-surface-raised px-4 text-body text-text-primary outline-none transition-[border-color,box-shadow] duration-quick placeholder:text-text-muted focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-focus-ring-offset focus-visible:[&:not([aria-invalid=true])]:border-accent aria-[invalid=true]:border-danger disabled:cursor-not-allowed disabled:bg-surface disabled:opacity-50",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

type TextFieldProps = Omit<React.ComponentProps<"input">, "aria-invalid" | "aria-describedby"> & {
  label: string;
  /** One short sentence under the field. An error replaces it. */
  helper?: string | undefined;
  /** Says what to do. Turns the border danger and is announced as an alert. */
  error?: string | undefined;
  /** A short note beside the label, such as "Required". It also describes the field. */
  labelHint?: string | undefined;
};

/** What the control inside a `Field` needs to be named, flagged and described. */
type FieldControlProps = {
  id: string;
  "aria-invalid": boolean;
  "aria-describedby": string | undefined;
};

type FieldProps = {
  id?: string | undefined;
  label: React.ReactNode;
  helper?: string | undefined;
  error?: string | undefined;
  labelHint?: string | undefined;
  disabled?: boolean | undefined;
  /** Draws the control from the props that tie it to the label and the message. */
  children: (control: FieldControlProps) => React.ReactNode;
};

// A label, a control, and a helper or an error. The control is named by the label and described by
// whichever message is showing. `TextField` and `NumericInput` both draw their control inside it.
function Field({ id, label, helper, error, labelHint, disabled, children }: FieldProps) {
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
  // The hint is read first, then whichever message is showing.
  const describedBy = [
    hint === undefined ? undefined : hintId,
    message === undefined ? undefined : messageId,
  ]
    .filter((identifier) => identifier !== undefined)
    .join(" ");

  const labelElement = (
    <label
      htmlFor={fieldId}
      className={cn(
        "flex items-center gap-1.5 text-caption text-text-secondary",
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
        "aria-invalid": errorText !== undefined,
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
      disabled={disabled}
    >
      {(control) => (
        <Input disabled={disabled} className={className} {...control} {...inputProps} />
      )}
    </Field>
  );
}

export { Field, Input, TextField };
export type { FieldControlProps, FieldProps, TextFieldProps };
