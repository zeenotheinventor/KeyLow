import { BackToResults } from "../BackToResults";

import type { RecipePortionStepProps } from "./types";

import { RecipeAmountFields } from "@/components/diary/RecipeAmountFields";
import { IconButton } from "@/components/ui/IconButton";

/**
 * The add dialog's amount step for a recipe, as the web diary's recipe boards draw it: a Results link, with the
 * favourite heart at the other end of its row, above the recipe's amount fields, which the edit dialog shares.
 * It has no Time field, as the time belongs to the plate.
 */
export function RecipePortionStep({
  draft,
  favouriteHeart,
  onBack,
  backLabel,
  amountRef,
}: RecipePortionStepProps) {
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <BackToResults onClick={onBack} label={backLabel} />
        {favouriteHeart !== undefined && <IconButton {...favouriteHeart} />}
      </div>
      <RecipeAmountFields recipe={draft.recipe} draft={draft} amountRef={amountRef} />
    </>
  );
}
