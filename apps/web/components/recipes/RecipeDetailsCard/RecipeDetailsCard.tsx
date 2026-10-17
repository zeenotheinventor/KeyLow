import {
  FOOD_FORM,
  RECIPE_EDITOR,
  describeCookedWeightHelper,
  describeServingsFieldSuffix,
} from "@keylow/core/copy";
import { useId } from "react";

import type { RecipeDetailsCardProps } from "./types";

import { Card } from "@/components/ui/Card";
import { TextField } from "@/components/ui/Input";
import { NumericInput } from "@/components/ui/NumericInput";

/**
 * The Details card of the recipe editor: the name, the servings and the cooked weight. The helper under the
 * fields says what a blank cooked weight means, and gives way to the sentence when the weight is wrong.
 */
export function RecipeDetailsCard({
  draft,
  errors,
  isLocked,
  onChange,
  nameRef,
  servingsRef,
  cookedWeightRef,
}: RecipeDetailsCardProps) {
  const helperId = useId();

  return (
    <Card asChild className="flex flex-col gap-3">
      <section aria-labelledby={`${helperId}-heading`}>
        <h2 id={`${helperId}-heading`} className="text-body-strong">
          {FOOD_FORM.details}
        </h2>
        <TextField
          ref={nameRef}
          label={FOOD_FORM.name}
          placeholder={RECIPE_EDITOR.namePlaceholder}
          autoComplete="off"
          value={draft.name}
          readOnly={isLocked}
          error={errors.name}
          onChange={(event) => {
            onChange("name", event.target.value);
          }}
        />
        <div className="flex flex-wrap gap-3">
          <div className="w-full min-[700px]:w-[200px]">
            <NumericInput
              ref={servingsRef}
              label={RECIPE_EDITOR.servings}
              aria-label={RECIPE_EDITOR.servings}
              unit={describeServingsFieldSuffix(draft.servings)}
              placeholder=""
              value={draft.servings}
              readOnly={isLocked}
              error={errors.servings}
              onChange={(event) => {
                onChange("servings", event.target.value);
              }}
            />
          </div>
          <div className="w-full min-[700px]:w-[200px]">
            <NumericInput
              ref={cookedWeightRef}
              label={RECIPE_EDITOR.cookedWeight}
              aria-label={RECIPE_EDITOR.cookedWeightName}
              unit="g"
              placeholder=""
              value={draft.cookedWeight}
              readOnly={isLocked}
              error={errors.cookedWeight}
              describedBy={errors.cookedWeight === undefined ? helperId : undefined}
              onChange={(event) => {
                onChange("cookedWeight", event.target.value);
              }}
            />
          </div>
        </div>
        {errors.cookedWeight === undefined && (
          <p id={helperId} className="text-caption tabular-nums text-text-muted">
            {describeCookedWeightHelper(draft.ingredients)}
          </p>
        )}
      </section>
    </Card>
  );
}
