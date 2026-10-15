import { useFood, useUpdateEntry } from "@keylow/api-client";
import { FOOD_CHANGED_BANNER, FOOD_DELETED_NOTICE } from "@keylow/core/copy";
import { formatClockTime } from "@keylow/core/dates";
import { foodChangedSinceLogged } from "@keylow/core/diary";
import { useState } from "react";

import { useIsOnline } from "../../../lib/connectivity";
import { foodEntryChange } from "../../../lib/entryChange";
import { foodEntryForm } from "../../../lib/entryForms";
import { useReadsEnabled } from "../../../lib/useReadsEnabled";
import { useDeleteEntryWithUndo } from "../../DiaryScreen";
import { PortionPicker } from "../../PortionPicker";
import { Banner } from "../../ui";

import type { FoodEntryFormProps } from "./types";
import type { PortionSelection } from "../../PortionPicker";

/**
 * A logged food on the entry screen: the portion picker drawn from the entry's own snapshot, with Save and
 * Delete. Changing the amount recomputes from the snapshot, never from the live food. When the live food
 * differs from the snapshot a banner offers "Update to current food data", the one thing that changes the
 * entry from the food. A food that has been deleted says so and offers no update; Save still works from
 * the snapshot. Save writes only what changed, and nothing at all when nothing did.
 */
export function FoodEntryForm({ entry, timeZone, onLeave }: FoodEntryFormProps) {
  const isOnline = useIsOnline();
  const updateEntry = useUpdateEntry();
  const deleteWithUndo = useDeleteEntryWithUndo();
  // The live food is read unfiltered, so a deleted food still answers. A food that cannot be read counts as
  // gone. Nothing is read while the terms gate is up, and a query with no id stays idle.
  const liveFood = useFood(useReadsEnabled() ? entry.snapshot.ref : undefined);
  const [isSaving, setIsSaving] = useState(false);
  const [hasSaveError, setHasSaveError] = useState(false);
  const { food, portions, initialAmount } = foodEntryForm(entry);

  const isFoodGone =
    liveFood.data !== undefined && (liveFood.data === null || liveFood.data.deleted_at !== null);
  const hasFoodChanged =
    liveFood.data !== undefined &&
    liveFood.data !== null &&
    !isFoodGone &&
    foodChangedSinceLogged(liveFood.data, entry.snapshot);

  async function save(selection: PortionSelection) {
    const change = foodEntryChange(entry, selection, timeZone);
    if (change === null) {
      onLeave();
      return;
    }
    setIsSaving(true);
    setHasSaveError(false);
    try {
      await updateEntry.mutateAsync({ entry, ...change });
      onLeave();
    } catch {
      // The failure is not kept: it can quote the amount, which is health data. The banner says what to do.
      setHasSaveError(true);
    } finally {
      setIsSaving(false);
    }
  }

  async function updateToCurrentFood() {
    if (isSaving) {
      return;
    }
    setIsSaving(true);
    setHasSaveError(false);
    try {
      await updateEntry.mutateAsync({ entry, useCurrentFoodData: true });
    } catch {
      setHasSaveError(true);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <PortionPicker
      banner={
        hasFoodChanged ? (
          <Banner
            // Updating writes the entry, which needs a connection, so offline there is nothing to press.
            action={
              isOnline
                ? {
                    label: FOOD_CHANGED_BANNER.action,
                    onPress: () => {
                      void updateToCurrentFood();
                    },
                  }
                : undefined
            }
            body={FOOD_CHANGED_BANNER.body}
            title={FOOD_CHANGED_BANNER.title}
            variant="info"
          />
        ) : null
      }
      caption={isFoodGone ? FOOD_DELETED_NOTICE : undefined}
      food={food}
      hasSaveError={hasSaveError}
      initialAmount={initialAmount}
      isNow={false}
      isOnline={isOnline}
      isSaving={isSaving}
      portions={portions}
      time={formatClockTime(new Date(entry.logged_at), timeZone)}
      onBack={onLeave}
      onDelete={() => {
        deleteWithUndo(entry);
        onLeave();
      }}
      onSubmit={(selection) => {
        void save(selection);
      }}
    />
  );
}
