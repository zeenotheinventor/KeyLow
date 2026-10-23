import { SAVE_FAILED_BANNER } from "@keylow/core/copy";

import { BackToResults } from "../BackToResults";

import type { RecipePortionStepProps } from "./types";

import { RecipeAmountFields } from "@/components/diary/RecipeAmountFields";
import { Banner } from "@/components/ui/Banner";

/**
 * The add dialog's amount step for a recipe, as the web diary's recipe boards draw it: a Results link above
 * the recipe's amount fields, which the edit dialog shares. A failed save is a banner above the badge, and
 * says what to do and nothing more.
 */
export function RecipePortionStep({
  draft,
  time,
  isNow,
  onTimeChange,
  onBack,
  amountRef,
}: RecipePortionStepProps) {
  return (
    <>
      <BackToResults onClick={onBack} />
      <RecipeAmountFields
        recipe={draft.recipe}
        draft={draft}
        time={time}
        isNow={isNow}
        onTimeChange={onTimeChange}
        amountRef={amountRef}
        notice={draft.hasSaveError && <Banner tone="error">{SAVE_FAILED_BANNER}</Banner>}
      />
    </>
  );
}
