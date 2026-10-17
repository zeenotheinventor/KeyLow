import { RECIPE_EDITOR, RECIPE_VIEW } from "@keylow/core/copy";
import { iconStroke } from "@keylow/tokens";
import { RotateCcw } from "lucide-react";

import type { ServingsCardProps } from "./types";

import { Card } from "@/components/ui/Card";
import { ServingsStepper } from "@/components/ui/ServingsStepper";

/**
 * The Servings card of the recipe view: the stepper that chooses how many servings to cook, what that
 * makes, and a way back to the recipe's own servings once they differ. It holds no sums: the view model
 * hands it the words, and the buttons are never turned off for being offline, since scaling is client
 * arithmetic.
 */
export function ServingsCard({
  text,
  onChangeText,
  value,
  valueText,
  canDecrease,
  canIncrease,
  onStep,
  error,
  onBlur,
  fieldRef,
  yieldLine,
  resetLabel,
  onReset,
}: ServingsCardProps) {
  return (
    <Card asChild padding="none">
      <section aria-label={RECIPE_EDITOR.servings} className="flex flex-col gap-2 px-4 py-3">
        <ServingsStepper
          label={RECIPE_EDITOR.servings}
          decreaseLabel={RECIPE_VIEW.fewerServings}
          increaseLabel={RECIPE_VIEW.moreServings}
          text={text}
          onChangeText={onChangeText}
          value={value}
          valueText={valueText}
          canDecrease={canDecrease}
          canIncrease={canIncrease}
          onStep={onStep}
          error={error}
          onBlur={onBlur}
          fieldRef={fieldRef}
        />
        <div className="flex min-h-6 flex-wrap items-center justify-between gap-x-3">
          <span className="text-caption tabular-nums text-text-secondary">{yieldLine}</span>
          {resetLabel !== null && (
            // The button is the 44 px hit area, and the negative margins keep the row as tall as the text.
            <button
              type="button"
              onClick={onReset}
              className="-mx-1 -my-[10px] inline-flex min-h-touch-target items-center gap-1 rounded-small px-1 text-[14px] font-semibold leading-5 text-accent-ink outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            >
              <RotateCcw aria-hidden className="size-4" strokeWidth={iconStroke} />
              {resetLabel}
            </button>
          )}
        </div>
      </section>
    </Card>
  );
}
