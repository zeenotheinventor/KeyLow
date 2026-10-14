import { ENERGY_NOT_GIVEN, FOOD_DETAIL, FOOD_MACRO_LABELS, describeBasis } from "@keylow/core/copy";
import { formatCalories } from "@keylow/core/format";
import { energyShares } from "@keylow/core/search";

import { MacroTile } from "./MacroTile";

import type { MacroHeroProps } from "./types";

import { Card } from "@/components/ui/card";

/** The energy of a food as a large number, with its protein, carbohydrate and fat under it. */
export function MacroHero({ food }: MacroHeroProps) {
  const shares = energyShares(food);

  return (
    <Card asChild className="flex flex-col gap-3">
      <section aria-label={FOOD_DETAIL.macrosLabel}>
        <div className="flex items-baseline gap-1.5">
          {food.kcal === null ? (
            <span className="text-h1 text-text-muted">{ENERGY_NOT_GIVEN}</span>
          ) : (
            <>
              <span className="text-display-numeral">{formatCalories(food.kcal)}</span>
              <span className="text-body-strong text-text-secondary">kcal</span>
            </>
          )}
          <span className="ml-auto text-caption text-text-muted">{describeBasis(food.basis)}</span>
        </div>
        <dl className="grid grid-cols-3 gap-2">
          <MacroTile
            label={FOOD_MACRO_LABELS.protein}
            colour="protein"
            grams={food.protein_g}
            share={shares.protein}
          />
          <MacroTile
            label={FOOD_MACRO_LABELS.carbs}
            colour="carbs"
            grams={food.carbs_g}
            share={shares.carbs}
          />
          <MacroTile
            label={FOOD_MACRO_LABELS.fat}
            colour="fat"
            grams={food.fat_g}
            share={shares.fat}
          />
        </dl>
      </section>
    </Card>
  );
}
