import {
  ENERGY_NOT_GIVEN,
  FOOD_DETAIL,
  FOOD_MACRO_LABELS,
  PORTION_PICKER,
  SHARES_OF_ENERGY_ARE_ESTIMATES,
  describeBasis,
} from "@keylow/core/copy";
import { formatCalories } from "@keylow/core/format";
import { energyShares } from "@keylow/core/search";

import { MacroTile } from "./MacroTile";

import type { MacroHeroProps } from "./types";

import { Card } from "@/components/ui/Card";

const NO_VALUES = { kcal: null, protein_g: null, carbs_g: null, fat_g: null };

/**
 * The energy of a food as a large number, with its protein, carbohydrate and fat under it. With `amount`
 * it shows the values and the caption of the chosen amount instead of the food's own, with each share as
 * a pill, and is a labelled group whose name includes the caption.
 */
export function MacroHero({ food, amount }: MacroHeroProps) {
  const values = amount === undefined ? food : amount.values;
  // Only an amount can have no values: the food's own always have, even if one is not given.
  const hasNoAmount = values === null;
  const shares = energyShares(values ?? NO_VALUES);
  const basis = amount === undefined ? describeBasis(food.basis) : amount.caption;
  // The note only explains the shares, so it goes when none is drawn.
  const hasShares = Object.values(shares).some((share) => share !== null);
  const tileVariant = amount === undefined ? "detail" : "amount";
  const hasNameLine = amount?.name !== undefined;

  // The dialogs draw the numeral at 44 on 48 and its unit as a caption, the food page at 56 on 60.
  const numeralClasses = hasNameLine ? "text-numeral-large" : "text-display-numeral";
  const unitClasses = hasNameLine
    ? "text-caption text-text-secondary"
    : "text-body-strong text-text-secondary";

  const energy = hasNoAmount ? (
    <>
      <span className={`${numeralClasses} text-text-muted`}>{PORTION_PICKER.noValue}</span>
      <span className={unitClasses}>kcal</span>
    </>
  ) : values.kcal === null ? (
    <span className="text-h1 text-text-muted">{ENERGY_NOT_GIVEN}</span>
  ) : (
    <>
      <span className={numeralClasses}>{formatCalories(values.kcal)}</span>
      <span className={unitClasses}>kcal</span>
    </>
  );

  return (
    <Card asChild className="flex flex-col gap-3">
      <section
        {...(amount === undefined
          ? { "aria-label": FOOD_DETAIL.macrosLabel }
          : { role: "group", "aria-label": `${FOOD_DETAIL.macrosLabel}, ${basis}` })}
      >
        {hasNameLine && (
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 text-body-strong">{amount.name}</span>
            <span className="shrink-0 text-caption tabular-nums text-text-muted">{basis}</span>
          </div>
        )}
        <div className="flex items-baseline gap-1.5">
          {energy}
          {!hasNameLine && <span className="ml-auto text-caption text-text-muted">{basis}</span>}
        </div>
        <dl
          className={
            amount === undefined
              ? "grid grid-cols-3 gap-2"
              : "grid grid-cols-1 gap-2 min-[700px]:grid-cols-3"
          }
        >
          <MacroTile
            label={FOOD_MACRO_LABELS.protein}
            colour="protein"
            grams={values?.protein_g ?? null}
            share={shares.protein}
            variant={tileVariant}
            isBlank={hasNoAmount}
          />
          <MacroTile
            label={FOOD_MACRO_LABELS.carbs}
            colour="carbs"
            grams={values?.carbs_g ?? null}
            share={shares.carbs}
            variant={tileVariant}
            isBlank={hasNoAmount}
          />
          <MacroTile
            label={FOOD_MACRO_LABELS.fat}
            colour="fat"
            grams={values?.fat_g ?? null}
            share={shares.fat}
            variant={tileVariant}
            isBlank={hasNoAmount}
          />
        </dl>
        {amount !== undefined && hasShares && (
          <span className="text-caption text-text-muted">{SHARES_OF_ENERGY_ARE_ESTIMATES}</span>
        )}
      </section>
    </Card>
  );
}
