import { MAX_RECIPE_SERVINGS } from "@keylow/core/recipes";
import { iconStroke } from "@keylow/tokens";
import { Minus, Plus } from "lucide-react";
import { useId } from "react";

import type { ServingsStepperProps } from "./types";
import type { KeyboardEvent } from "react";

import { Button } from "@/components/ui/Button";
import { NumericInput } from "@/components/ui/NumericInput";

// The recipe view's range of servings. The stepper only announces it: it does not check the text.
const MINIMUM_SERVINGS = 1;

// A button that cannot act stays a tab stop, so a keyboard user hears why, and so it does not drop
// focus when a step reaches the end of the range. `aria-disabled` takes the place of `disabled`.
const stepButtonClasses = "aria-disabled:pointer-events-none aria-disabled:opacity-40";

/**
 * Sets the servings by a minus button, a field and a plus button, with the label on the left of the
 * row and an error sentence under it. It holds no rules: it does not parse, clamp or validate the
 * text, and the caller says what each button can do. The field is a spinbutton, so ArrowUp and
 * ArrowDown step it too.
 */
export function ServingsStepper({
  label,
  decreaseLabel,
  increaseLabel,
  text,
  onChangeText,
  value,
  valueText,
  canDecrease,
  canIncrease,
  onStep,
  error,
  onBlur,
  disabled,
  fieldRef,
}: ServingsStepperProps) {
  const fieldId = useId();
  const errorId = useId();
  const hasError = error !== undefined && error.trim() !== "";
  const canStepDown = canDecrease && disabled !== true;
  const canStepUp = canIncrease && disabled !== true;

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (canStepUp) {
        onStep(1);
      }
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      if (canStepDown) {
        onStep(-1);
      }
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        {/* The field takes its name from `aria-label`, so this label and the field's own hidden one do not add up. */}
        <label htmlFor={fieldId} className="text-body-strong text-text-primary">
          {label}
        </label>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            iconOnly
            aria-label={decreaseLabel}
            aria-disabled={canStepDown ? undefined : true}
            className={stepButtonClasses}
            onClick={() => {
              if (canStepDown) {
                onStep(-1);
              }
            }}
          >
            <Minus aria-hidden strokeWidth={iconStroke} />
          </Button>
          <div className="w-[4.5rem]">
            <NumericInput
              ref={fieldRef}
              id={fieldId}
              label={label}
              aria-label={label}
              hideLabel
              role="spinbutton"
              inputMode="numeric"
              autoComplete="off"
              placeholder=""
              aria-valuemin={MINIMUM_SERVINGS}
              aria-valuemax={MAX_RECIPE_SERVINGS}
              aria-valuenow={value}
              aria-valuetext={valueText}
              className="text-center text-body-strong"
              frameClassName="px-2"
              value={text}
              disabled={disabled}
              invalid={hasError}
              describedBy={hasError ? errorId : undefined}
              onChange={(event) => {
                onChangeText(event.target.value);
              }}
              onBlur={onBlur}
              onKeyDown={handleKeyDown}
            />
          </div>
          <Button
            type="button"
            variant="secondary"
            iconOnly
            aria-label={increaseLabel}
            aria-disabled={canStepUp ? undefined : true}
            className={stepButtonClasses}
            onClick={() => {
              if (canStepUp) {
                onStep(1);
              }
            }}
          >
            <Plus aria-hidden strokeWidth={iconStroke} />
          </Button>
        </div>
      </div>
      {hasError && (
        <span id={errorId} role="alert" className="self-end text-right text-caption text-danger">
          {error}
        </span>
      )}
    </div>
  );
}
