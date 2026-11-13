import { describeRecipeDraftCard } from "@keylow/core";
import { OPEN_IN_RECIPE_EDITOR, RECIPE_DRAFT_WORDS } from "@keylow/core/copy";
import { memo, useMemo } from "react";

import { AssistantRecipeDraftCard } from "../../ui";
import { useRecipeDraftSave } from "../useRecipeDraftSave";

import type { AssistantRecipeDraftEntryProps } from "./types";

/**
 * The suggested recipe card in the thread, with what it does. Save to recipes opens the new recipe editor filled
 * in with the draft (`useRecipeDraftSave`), and once the editor has saved it the card shows it as saved, with
 * the link that opens the recipe. Adjust only puts words in the composer. It is memoised, because the thread
 * draws again for every streamed token: its draft is a stable reference and the sheet gives it stable handlers.
 */
export const AssistantRecipeDraftEntry = memo(function AssistantRecipeDraftEntry({
  draft,
  onOpenEditor,
  onAdjust,
  onOpenSavedRecipe,
}: AssistantRecipeDraftEntryProps) {
  const { status, savedRecipeId, save } = useRecipeDraftSave(draft, onOpenEditor);
  const card = useMemo(
    () => describeRecipeDraftCard(draft, { isSaved: savedRecipeId !== undefined }),
    [draft, savedRecipeId],
  );

  return (
    <AssistantRecipeDraftCard
      adjustLabel={RECIPE_DRAFT_WORDS.adjust}
      card={card}
      isSaving={status === "saving"}
      saveError={status === "failed" ? RECIPE_DRAFT_WORDS.saveFailed : undefined}
      saveLabel={RECIPE_DRAFT_WORDS.save}
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
      onAdjust={onAdjust}
      onSave={() => {
        void save();
      }}
    />
  );
});
