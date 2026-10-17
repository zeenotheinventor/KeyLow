import { useRecipe } from "@keylow/api-client";
import { RECIPE_ARCHIVED_NOTICE } from "@keylow/core/copy";
import { formatClockTime } from "@keylow/core/dates";
import { recipeOfSnapshot } from "@keylow/core/recipes";
import { useRef } from "react";

import { useIsOnline } from "../../../lib/connectivity";
import { recipeEntryChange } from "../../../lib/entryChange";
import { useReadsEnabled } from "../../../lib/useReadsEnabled";
import { useDeleteEntryWithUndo } from "../../DiaryScreen";
import { PortionPicker } from "../../PortionPicker";
import { useEntrySave } from "../useEntrySave";

import type { RecipeEntryFormProps } from "./types";

/**
 * A logged recipe on the entry screen: the picker's recipe page drawn from the entry's own snapshot (its
 * yield line as it was when logged, its hero and its values per 100 g), with Save and Delete. Changing the
 * amount recomputes from the snapshot in core, never from the live recipe, which is read for one thing only:
 * whether it has been archived, in which case a line says the entry keeps its saved values. A recipe that
 * cannot be read says nothing, and the entry edits from its snapshot. There is no way to update the entry
 * to the current recipe: to use an edited recipe, log it again. Save writes only what changed, and nothing
 * at all when nothing did. Delete acts at once, once, and the diary says so with Undo.
 */
export function RecipeEntryForm({ entry, timeZone, onLeave }: RecipeEntryFormProps) {
  const isOnline = useIsOnline();
  const entrySave = useEntrySave(onLeave);
  const deleteWithUndo = useDeleteEntryWithUndo();
  const areReadsEnabled = useReadsEnabled();
  const liveRecipe = useRecipe(entry.recipe_id, { enabled: areReadsEnabled });
  // Set in the same tick as the press, which a state update is not, so a second press cannot delete twice.
  const hasDeleted = useRef(false);

  return (
    <PortionPicker
      amount={{ quantity: entry.quantity, unit: entry.unit }}
      caption={
        liveRecipe.status === "ready" && liveRecipe.recipe.is_archived
          ? RECIPE_ARCHIVED_NOTICE
          : undefined
      }
      hasSaveError={entrySave.hasSaveError}
      isOnline={isOnline}
      isSaving={entrySave.isSaving}
      mode="edit-recipe"
      recipe={recipeOfSnapshot(entry.snapshot)}
      time={formatClockTime(new Date(entry.logged_at), timeZone)}
      onBack={onLeave}
      onDelete={() => {
        if (hasDeleted.current) {
          return;
        }
        hasDeleted.current = true;
        deleteWithUndo(entry);
        onLeave();
      }}
      onSubmit={(selection) => {
        const change = recipeEntryChange(entry, selection, timeZone);
        void entrySave.save(change === null ? null : { entry, ...change });
      }}
    />
  );
}
