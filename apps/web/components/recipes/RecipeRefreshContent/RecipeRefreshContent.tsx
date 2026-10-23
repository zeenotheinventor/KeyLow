import {
  FOOD_MACRO_LABELS,
  RECIPE_EDITOR,
  REFRESH,
  amountCaptionOf,
  beforeAfterFigures,
  describeCountSuffix,
} from "@keylow/core/copy";
import { CircleCheck } from "lucide-react";
import { useId } from "react";

import type { RecipeRefreshContentProps } from "./types";
import type { ReactNode } from "react";

import { BeforeAfterRow } from "@/components/recipes/BeforeAfterRow";
import { ChangedIngredientCard } from "@/components/recipes/ChangedIngredientCard";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListRow } from "@/components/ui/ListRow";

// The state sits in the middle of the room the dialog has, a little above the centre.
const NOTHING_TO_REFRESH_CLASSES = "flex-1 justify-center border-0 bg-transparent px-6 py-0 pb-20";

function Section({
  heading,
  count,
  children,
}: {
  heading: string;
  count: number;
  children: ReactNode;
}) {
  const headingId = useId();

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <h3 className="text-body-strong">
        <span id={headingId}>{heading}</span>
        <span className="text-caption tabular-nums text-text-muted">
          {describeCountSuffix(count)}
        </span>
      </h3>
      {children}
    </section>
  );
}

/**
 * What the refresh dialog shows once the foods have been checked. With changes: the intro, the Per serving
 * card before and after, the changed ingredients, any that are kept as they are because their food has been
 * deleted, and the ones that did not change. With none: "Nothing to refresh" with Done, and above it the kept
 * ingredients, since a deleted food is still news. It holds no diff of its own: what changed, the figures and
 * the sentences are core's, read from the diff as it came.
 */
export function RecipeRefreshContent({ diff, introRef, onDone }: RecipeRefreshContentProps) {
  // The change at a place and the ingredient at that place are the same ingredient, in the recipe's order.
  const rows = diff.changes.flatMap((change, position) => {
    const ingredient = diff.ingredients[position];
    return ingredient === undefined ? [] : [{ change, amountCaption: amountCaptionOf(ingredient) }];
  });
  const changed = rows.filter(({ change }) => change.changed);
  const kept = rows.filter(({ change }) => change.foodGone);
  const unchanged = rows.filter(({ change }) => !change.changed && !change.foodGone);

  const keptSection = kept.length > 0 && (
    <Section heading={REFRESH.kept} count={kept.length}>
      {kept.map(({ change, amountCaption }) => (
        <Card key={change.position} padding="none" className="flex flex-col gap-1 px-4 py-3">
          <span className="text-body-strong">{change.name.after}</span>
          <span className="text-caption tabular-nums text-text-muted">{amountCaption}</span>
          <span className="text-caption text-text-secondary">{REFRESH.foodGone}</span>
        </Card>
      ))}
    </Section>
  );

  if (!diff.hasChanges) {
    return (
      <div className="flex flex-1 flex-col gap-4">
        {keptSection}
        <EmptyState
          icon={CircleCheck}
          tone="success"
          title={REFRESH.nothingTitle}
          body={REFRESH.nothingBody}
          action={{ label: REFRESH.done, onClick: onDone }}
          className={NOTHING_TO_REFRESH_CLASSES}
        />
      </div>
    );
  }

  const { perServing } = diff;

  return (
    <div className="flex flex-col gap-4">
      <p ref={introRef} tabIndex={-1} className="text-body text-text-secondary outline-none">
        {REFRESH.intro}
      </p>
      <Card asChild padding="none">
        <section aria-label={REFRESH.perServingRegionName} className="flex flex-col px-4 pb-2 pt-3">
          <h3 className="mb-1 text-body-strong">{RECIPE_EDITOR.perServingNoValue}</h3>
          <BeforeAfterRow
            label={REFRESH.calories}
            marker="none"
            figures={beforeAfterFigures(REFRESH.calories, perServing.kcal, "energy")}
          />
          <BeforeAfterRow
            hasDivider
            label={FOOD_MACRO_LABELS.protein}
            marker="protein"
            figures={beforeAfterFigures(FOOD_MACRO_LABELS.protein, perServing.protein_g, "grams")}
          />
          <BeforeAfterRow
            hasDivider
            label={FOOD_MACRO_LABELS.carbs}
            marker="carbs"
            figures={beforeAfterFigures(FOOD_MACRO_LABELS.carbs, perServing.carbs_g, "grams")}
          />
          <BeforeAfterRow
            hasDivider
            label={FOOD_MACRO_LABELS.fat}
            marker="fat"
            figures={beforeAfterFigures(FOOD_MACRO_LABELS.fat, perServing.fat_g, "grams")}
          />
        </section>
      </Card>
      <Section heading={REFRESH.changed} count={changed.length}>
        {changed.map(({ change, amountCaption }) => (
          <ChangedIngredientCard
            key={change.position}
            change={change}
            amountCaption={amountCaption}
          />
        ))}
      </Section>
      {keptSection}
      {unchanged.length > 0 && (
        <Section heading={REFRESH.unchanged} count={unchanged.length}>
          <Card asChild padding="none">
            <ul className="divide-y divide-border">
              {unchanged.map(({ change, amountCaption }) => (
                <ListRow
                  key={change.position}
                  title={change.name.after}
                  subtitle={amountCaption}
                  className="min-h-[52px] px-4"
                />
              ))}
            </ul>
          </Card>
        </Section>
      )}
    </div>
  );
}
