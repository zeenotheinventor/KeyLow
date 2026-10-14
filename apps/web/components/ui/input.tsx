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
  helper?: string;
  /** Says what to do. Turns the border danger and is announced as an alert. */
  error?: string;
};

// A label, an input, and a helper or an error as one field. The input is named by the label and
// described by whichever message is showing.
function TextField({
  id,
  label,
  helper,
  error,
  disabled,
  className,
  ...inputProps
}: TextFieldProps) {
  const generatedId = React.useId();
  const fieldId = id ?? generatedId;
  const messageId = `${fieldId}-message`;
  // An empty error is no error, so it neither flags the field nor puts an empty alert on the page.
  const errorText = error?.trim() === "" ? undefined : error;
  const message = errorText ?? helper;
  const mutedWhenDisabled = disabled === true && "opacity-50";

  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={fieldId}
        className={cn("text-caption text-text-secondary", mutedWhenDisabled)}
      >
        {label}
      </label>
      <Input
        id={fieldId}
        disabled={disabled}
        className={className}
        aria-invalid={errorText !== undefined}
        aria-describedby={message === undefined ? undefined : messageId}
        {...inputProps}
      />
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

export { Input, TextField };
export type { TextFieldProps };
