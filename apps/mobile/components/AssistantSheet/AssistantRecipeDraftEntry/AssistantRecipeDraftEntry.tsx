import { useFoodsWithPortionsLoader } from "@keylow/api-client";
import {
  describeRecipeDraftCard,
  firstUnmatchedLineNameOf,
  matchedFoodIdsOf,
  recipeDraftKeyOf,
  recipeDraftPrefillOf,
} from "@keylow/core";
import { OPEN_IN_RECIPE_EDITOR, RECIPE_DRAFT_WORDS } from "@keylow/core/copy";
import { memo, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import {
  beginRecipePrefill,
  consumeRecipePrefill,
  savedRecipeIdOfDraft,
  subscribeRecipePrefill,
} from "../../../lib/recipePrefill";
import { newRecipePrefillPath } from "../../../lib/recipeRoutes";
import { AssistantRecipeDraftCard } from "../../ui";

import type { AssistantRecipeDraftEntryProps } from "./types";

type SaveStatus = "idle" | "saving" | "failed";

/**
 * The suggested recipe card in the thread, with what it does. Save to recipes loads the foods of the draft and
 * opens the new recipe editor filled in with it: nothing is written until the person saves there. When the
 * foods cannot be loaded (the connection, or a food that is gone) the card stays as it was and says it was not
 * saved, with Save to recipes still there to press again. Once the editor has saved the draft, the card shows
 * it as saved, with the link that opens the recipe. That is known for as long as the app runs, and the card
 * reads as not saved again after a restart. Adjust only puts words in the composer. Nothing about the recipe
 * is logged: a failure is a state, never a message. A save that finishes after the sheet closed opens nothing.
 * It is memoised, because the thread draws again for every streamed token: its draft is a stable reference and
 * the sheet gives it stable handlers.
 */
export const AssistantRecipeDraftEntry = memo(function AssistantRecipeDraftEntry({
  draft,
  onOpenEditor,
  onAdjust,
  onOpenSavedRecipe,
}: AssistantRecipeDraftEntryProps) {
  const draftKey = useMemo(() => recipeDraftKeyOf(draft), [draft]);
  // Whether the card is still on screen, so a save that finishes after it has gone opens nothing.
  const isMounted = useRef(true);
  useEffect(
    () => () => {
      isMounted.current = false;
    },
    [],
  );
  const savedRecipeId = useSyncExternalStore(subscribeRecipePrefill, () =>
    savedRecipeIdOfDraft(draftKey),
  );
  const loadFoods = useFoodsWithPortionsLoader();
  const [status, setStatus] = useState<SaveStatus>("idle");
  const card = useMemo(
    () => describeRecipeDraftCard(draft, { isSaved: savedRecipeId !== undefined }),
    [draft, savedRecipeId],
  );

  async function save() {
    if (status === "saving") {
      return;
    }
    setStatus("saving");
    try {
      const foods = await loadFoods(matchedFoodIdsOf(draft));
      if (!isMounted.current) {
        return;
      }
      const prefill = recipeDraftPrefillOf(draft, foods);
      if (prefill === null) {
        setStatus("failed");
        return;
      }
      const prefillId = beginRecipePrefill({
        draft: prefill,
        draftKey,
        searchWord: firstUnmatchedLineNameOf(draft),
      });
      setStatus("idle");
      if (!onOpenEditor(newRecipePrefillPath(prefillId))) {
        consumeRecipePrefill(prefillId);
      }
    } catch {
      if (isMounted.current) {
        setStatus("failed");
      }
    }
  }

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
