import { RECIPE_EDITOR, describeCountSuffix } from "@keylow/core/copy";
import { iconStroke } from "@keylow/tokens";
import { Info } from "lucide-react";
import { useId } from "react";

import { StepRow } from "../StepRow";

import type { RecipeViewStepsCardProps } from "./types";

import { Card } from "@/components/ui/Card";

/** The Instructions card of the recipe view: the heading with its count, the servings note when scaled, and the steps. */
export function RecipeViewStepsCard({ steps, servingsNote }: RecipeViewStepsCardProps) {
  const headingId = useId();

  return (
    <Card asChild padding="none">
      <section aria-labelledby={headingId}>
        <div className="flex flex-col gap-1 px-4 pb-3 pt-4">
          <h2 id={headingId} className="text-body-strong">
            {RECIPE_EDITOR.instructions}
            <span className="text-caption tabular-nums text-text-muted">
              {describeCountSuffix(steps.length)}
            </span>
          </h2>
          {servingsNote !== null && (
            <p className="flex items-center gap-1.5 text-caption text-text-secondary">
              <Info
                aria-hidden
                className="size-4 shrink-0 text-text-muted"
                strokeWidth={iconStroke}
              />
              {servingsNote}
            </p>
          )}
        </div>
        <ol>
          {steps.map((text, position) => (
            // Two steps can say the same thing, so the place in the method is the identity.
            <StepRow key={position} number={position + 1} text={text} />
          ))}
        </ol>
      </section>
    </Card>
  );
}
