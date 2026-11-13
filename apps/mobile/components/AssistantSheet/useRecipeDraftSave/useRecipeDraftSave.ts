import { useFoodsWithPortionsLoader } from "@keylow/api-client";
import {
  firstUnmatchedLineNameOf,
  matchedFoodIdsOf,
  recipeDraftKeyOf,
  recipeDraftPrefillOf,
} from "@keylow/core";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import {
  beginRecipePrefill,
  consumeRecipePrefill,
  savedRecipeIdOfDraft,
  subscribeRecipePrefill,
} from "../../../lib/recipePrefill";
import { newRecipePrefillPath } from "../../../lib/recipeRoutes";

import type { RecipeDraftSave } from "./types";
import type { AssistantRecipeDraft } from "@keylow/core";

/**
 * What a recipe card does when its save is pressed, for the suggested recipe and the compare card alike. It
 * loads the foods of the draft and opens the new recipe editor filled in with it: nothing is written until the
 * person saves there. When the foods cannot be loaded (the connection, or a food that is gone) `status` is
 * `failed` and the card stays as it was. When the draft has a line that cannot be made again in grams it is
 * `cannot_rebuild`, which no retry will change. Once the editor has saved the draft, `savedRecipeId` is the recipe it
 * made, for as long as the app runs. Nothing about the recipe is logged: a failure is a state, never a message.
 * A save that finishes after the card has gone opens nothing.
 */
export function useRecipeDraftSave(
  draft: AssistantRecipeDraft,
  onOpenEditor: (href: string) => boolean,
): RecipeDraftSave {
  const draftKey = useMemo(() => recipeDraftKeyOf(draft), [draft]);
  // Whether the card is still on screen, so a save that finishes after it has gone opens nothing.
  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);
  const savedRecipeId = useSyncExternalStore(subscribeRecipePrefill, () =>
    savedRecipeIdOfDraft(draftKey),
  );
  const loadFoods = useFoodsWithPortionsLoader();
  const [status, setStatus] = useState<RecipeDraftSave["status"]>("idle");

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
      if (!prefill.ok) {
        setStatus(prefill.reason === "food_missing" ? "failed" : "cannot_rebuild");
        return;
      }
      const prefillId = beginRecipePrefill({
        draft: prefill.draft,
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

  return { status, savedRecipeId, save };
}
