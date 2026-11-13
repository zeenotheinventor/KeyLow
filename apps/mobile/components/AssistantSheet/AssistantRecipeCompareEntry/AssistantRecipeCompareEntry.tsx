import { describeRecipeCompareCard } from "@keylow/core";
import { OPEN_IN_RECIPE_EDITOR, RECIPE_COMPARE_WORDS, RECIPE_DRAFT_WORDS } from "@keylow/core/copy";
import { memo, useMemo } from "react";

import { AssistantRecipeCompareCard } from "../../ui";
import { useRecipeDraftSave } from "../useRecipeDraftSave";

import type { RecipeDraftSave } from "../useRecipeDraftSave";
import type { AssistantRecipeCompareEntryProps } from "./types";

const saveErrorOf = (status: RecipeDraftSave["status"]): string | undefined => {
  if (status === "failed") {
    return RECIPE_DRAFT_WORDS.saveFailed;
  }
  return status === "cannot_rebuild" ? RECIPE_COMPARE_WORDS.cannotSave : undefined;
};

/**
 * The compare card in the thread, with what it does. Save as new recipe opens the new recipe editor filled in
 * with the adjusted recipe (`useRecipeDraftSave`): nothing is written until the person saves there, and the
 * original recipe is never touched, because the editor makes a new one. Once it has saved, the card shows it as
 * saved, with the link that opens the new recipe. It is memoised, because the thread draws again for every
 * streamed token: its draft is a stable reference and the sheet gives it stable handlers.
 */
export const AssistantRecipeCompareEntry = memo(function AssistantRecipeCompareEntry({
  draft,
  onOpenEditor,
  onOpenSavedRecipe,
}: AssistantRecipeCompareEntryProps) {
  const { status, savedRecipeId, save } = useRecipeDraftSave(draft, onOpenEditor);
  const card = useMemo(
    () => describeRecipeCompareCard(draft, { isSaved: savedRecipeId !== undefined }),
    [draft, savedRecipeId],
  );

  return (
    <AssistantRecipeCompareCard
      card={card}
      isSaving={status === "saving"}
      saveError={saveErrorOf(status)}
      saveLabel={RECIPE_COMPARE_WORDS.save}
      savedLink={
        savedRecipeId === undefined
          ? undefined
          : {
              label: OPEN_IN_RECIPE_EDITOR,
              onPress: () => {
                onOpenSavedRecipe(savedRecipeId);
              },
            }
      }
      onSave={() => {
        void save();
      }}
    />
  );
});
