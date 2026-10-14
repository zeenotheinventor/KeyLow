import type { NumericInputMacro, NumericInputProps } from "./types";
import type * as React from "react";

import { Field } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const macroMarks = {
  protein: "bg-protein",
  carbs: "bg-carbs",
  fat: "bg-fat",
} as const satisfies Record<NumericInputMacro, string>;

// The same box as `Input`: 44 high, raised surface, medium radius, accent border and ring on focus,
// danger border when invalid. The input sits inside it with the unit after it, so the box takes
// the focus and the invalid state from the input through `has`.
const frameClasses =
  "flex h-[44px] items-center gap-2 rounded-medium border bg-surface-raised px-4 transition-[border-color,box-shadow] duration-quick has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-focus-ring has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-focus-ring-offset has-[:disabled]:bg-surface has-[:disabled]:opacity-50";

// The return type names React on purpose: the repo has two copies of @types/react (KEY-125), and a
// file that imports react gets the JSX types that match the input props from `./types`.
/** A number with its unit after it, such as 165 kcal. It is a `TextField` whose digits are right aligned and tabular. */
export function NumericInput({
  id,
  label,
  helper,
  error,
  labelHint,
  unit,
  macro,
  disabled,
  className,
  placeholder = "0",
  ...inputProps
}: NumericInputProps): React.JSX.Element {
  return (
    <Field
      id={id}
      label={
        <>
          {macro !== undefined && (
            <span aria-hidden className={cn("size-2 rounded-[2px]", macroMarks[macro])} />
          )}
          {label}
          {/* The suffix is drawn for the eye. The unit is part of the name so it is also heard. */}
          {unit !== undefined && (
            <>
              {" "}
              <span className="sr-only">({unit})</span>
            </>
          )}
        </>
      }
      helper={helper}
      error={error}
      labelHint={labelHint}
      disabled={disabled}
    >
      {(control) => (
        <div
          className={cn(
            frameClasses,
            control["aria-invalid"]
              ? "border-danger"
              : "border-border has-[:focus-visible]:border-accent",
          )}
        >
          <input
            type="text"
            inputMode="decimal"
            disabled={disabled}
            placeholder={placeholder}
            className={cn(
              "h-10 min-w-0 flex-1 bg-transparent p-0 text-right text-body tabular-nums text-text-primary outline-none placeholder:text-text-muted",
              className,
            )}
            {...control}
            {...inputProps}
          />
          {unit !== undefined && (
            <span aria-hidden className="text-body text-text-muted">
              {unit}
            </span>
          )}
        </div>
      )}
    </Field>
  );
}
