import * as React from "react";

import type { TextAreaProps } from "./types";

import { cn } from "@/lib/utils";

// The same box as `Input`, taller: a raised surface, medium radius, 96 high at the least, 12 across and
// 10 down. It grows with the text and never scrolls. Focus turns the border to the accent, which is the
// whole indicator in dark. The light accent border is under 3:1 against the page, so light also adds the
// ring. An invalid field keeps its danger border while focused, so it keeps the ring in both themes.
const boxClassName =
  "block min-h-24 w-full resize-none overflow-hidden rounded-medium border border-border bg-surface-raised px-3 py-[10px] text-body text-text-primary outline-none transition-[border-color,box-shadow] duration-quick placeholder:text-text-muted light-theme:focus-visible:ring-2 focus-visible:ring-focus-ring light-theme:focus-visible:ring-offset-2 focus-visible:ring-offset-focus-ring-offset focus-visible:[&:not([aria-invalid=true])]:border-accent aria-[invalid=true]:border-danger aria-[invalid=true]:focus-visible:ring-2 aria-[invalid=true]:focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-surface disabled:opacity-50";

// The height the text needs is read from the element after it is let shrink, so deleting text gives the
// room back. It is only known at runtime and has no class, so it is set on the element and not as a style
// prop.
function growToFit(field: HTMLTextAreaElement) {
  field.style.height = "auto";
  field.style.height = `${field.scrollHeight}px`;
}

function setRef<T>(ref: React.Ref<T> | undefined, node: T | null) {
  if (typeof ref === "function") {
    ref(node);
  } else if (ref) {
    ref.current = node;
  }
}

/**
 * A multi-line field that grows with its text, with a label, an error and an optional counter. The counter
 * and anything in `footer` share one line under the box, so a pair of buttons can sit beside the count.
 * The field is described by its error and its counter.
 */
const TextArea = React.forwardRef<HTMLTextAreaElement, TextAreaProps>(
  (
    {
      id,
      label,
      hideLabel,
      error,
      counter,
      isOverLimit,
      footer,
      className,
      disabled,
      onInput,
      ...textAreaProps
    },
    ref,
  ) => {
    const generatedId = React.useId();
    const fieldId = id ?? generatedId;
    const errorId = `${fieldId}-error`;
    const counterId = `${fieldId}-counter`;
    // An empty error is no error, so it neither flags the field nor puts an empty alert on the page.
    const errorText = error?.trim() === "" ? undefined : error;
    const describedBy = [
      errorText === undefined ? undefined : errorId,
      counter === undefined ? undefined : counterId,
    ]
      .filter((identifier) => identifier !== undefined)
      .join(" ");

    const field = React.useRef<HTMLTextAreaElement | null>(null);
    const keepField = React.useCallback(
      (node: HTMLTextAreaElement | null) => {
        field.current = node;
        setRef(ref, node);
      },
      [ref],
    );

    // A field that is given its value regrows when the value changes. One that holds its own is grown as it is typed into.
    React.useLayoutEffect(() => {
      if (field.current !== null) {
        growToFit(field.current);
      }
    }, [textAreaProps.value]);

    return (
      <div className="flex flex-col gap-2">
        <label
          htmlFor={fieldId}
          className={cn(
            "text-caption text-text-secondary",
            hideLabel === true && "sr-only",
            disabled === true && "opacity-50",
          )}
        >
          {label}
        </label>
        <textarea
          id={fieldId}
          ref={keepField}
          disabled={disabled}
          aria-invalid={errorText !== undefined}
          aria-describedby={describedBy === "" ? undefined : describedBy}
          className={cn(boxClassName, className)}
          onInput={(event) => {
            growToFit(event.currentTarget);
            onInput?.(event);
          }}
          {...textAreaProps}
        />
        {errorText !== undefined && (
          <span
            // The key remounts the message when the error changes, so the alert is announced again.
            key={errorText}
            id={errorId}
            role="alert"
            className="text-caption text-danger"
          >
            {errorText}
          </span>
        )}
        {(footer !== undefined || counter !== undefined) && (
          <div className="flex items-center gap-2">
            {footer}
            {counter !== undefined && (
              <span
                id={counterId}
                className={cn(
                  "ml-auto text-caption tabular-nums",
                  // Small text is not coloured in light, so there the danger shows in the border and the sentence.
                  isOverLimit === true
                    ? "text-danger light-theme:text-text-primary"
                    : "text-text-muted",
                )}
              >
                {counter}
              </span>
            )}
          </div>
        )}
      </div>
    );
  },
);
TextArea.displayName = "TextArea";

export { TextArea };
