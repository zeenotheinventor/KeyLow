import type { NumericInputMacro, NumericInputProps } from "./types";

import { Field } from "@/components/ui/Input";
import { cn } from "@/lib/utils";

const macroMarks = {
  protein: "bg-protein",
  carbs: "bg-carbs",
  fat: "bg-fat",
} as const satisfies Record<NumericInputMacro, string>;

// The same box as `Input`: 44 high, raised surface, medium radius, accent border on focus with the
// ring added in light, danger border when invalid. An invalid box has no border change to show
// focus, so it keeps the ring in both themes. The input sits inside it with the unit after it, so
// the box takes the focus from the input through `has`.
const frameClasses =
  "flex h-control-md items-center gap-2 rounded-medium border bg-surface-raised px-4 transition-[border-color,box-shadow] duration-quick light-theme:has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-focus-ring light-theme:has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-focus-ring-offset has-[:disabled]:bg-surface has-[:disabled]:opacity-50";

/** A number with its unit after it, such as 165 kcal. It is a `TextField` whose digits are right aligned and tabular. */
export function NumericInput({
  id,
  label,
  helper,
  error,
  labelHint,
  invalid,
  describedBy,
  unit,
  macro,
  disabled,
  className,
  frameClassName,
  placeholder = "0",
  ...inputProps
}: NumericInputProps) {
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
      invalid={invalid}
      describedBy={describedBy}
      disabled={disabled}
    >
      {(control) => (
        <div
          className={cn(
            frameClasses,
            control["aria-invalid"]
              ? "border-danger has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-offset-2"
              : "border-border has-[:focus-visible]:border-accent",
            frameClassName,
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
