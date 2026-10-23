import { useFood, useFoodPortions, useRefreshOutdatedOffFood } from "@keylow/api-client";
import { FOOD_CHANGED_BANNER, FOOD_DELETED_NOTICE } from "@keylow/core/copy";
import { formatClockTime } from "@keylow/core/dates";
import { foodChangedSinceLogged, foodOfSnapshot } from "@keylow/core/diary";

import { useIsOnline } from "../../../lib/connectivity";
import { foodEntryChange } from "../../../lib/entryChange";
import { useReadsEnabled } from "../../../lib/useReadsEnabled";
import { useDeleteEntryWithUndo } from "../../DiaryScreen";
import { PortionPicker } from "../../PortionPicker";
import { Banner } from "../../ui";
import { useEntrySave } from "../useEntrySave";

import type { FoodEntryFormProps } from "./types";

/**
 * A logged food on the entry screen: the portion picker drawn from the entry's own snapshot (its amount and
 * its hero) with the chips of the food's portions as they are now, with Save and Delete. Changing the
 * amount recomputes from the snapshot, never from the live food. When the live food differs from the
 * snapshot a banner offers "Update to current food data", the one thing that changes the entry from the
 * food. A food that has been deleted says so and offers no update; Save still works from the snapshot.
 * Save writes only what changed, and nothing at all when nothing did.
 */
export function FoodEntryForm({ entry, timeZone, onLeave }: FoodEntryFormProps) {
  const isOnline = useIsOnline();
  const entrySave = useEntrySave(onLeave);
  const deleteWithUndo = useDeleteEntryWithUndo();
  // The live food is read unfiltered, so a deleted food still answers. A food that is not visible to the user
  // (null) counts as gone, and a read that failed says nothing. Nothing is read while the terms gate is up, and
  // a query with no id stays idle.
  const areReadsEnabled = useReadsEnabled();
  const liveFood = useFood(areReadsEnabled ? entry.snapshot.ref : undefined);

  const isFoodGone =
    liveFood.data !== undefined && (liveFood.data === null || liveFood.data.deleted_at !== null);
  // The food's portions are offered as chips only while the food is there to take them from.
  const isFoodThere = liveFood.data !== undefined && !isFoodGone;
  // A branded food stored before the current portion rules gets its new portions in the background.
  useRefreshOutdatedOffFood(isFoodThere ? liveFood.data : undefined);
  const livePortions = useFoodPortions(
    areReadsEnabled && isFoodThere ? entry.snapshot.ref : undefined,
  );
  const hasFoodChanged =
    liveFood.data !== undefined &&
    liveFood.data !== null &&
    !isFoodGone &&
    // The density of a serving label comes from the portions, so wait for them to be there to compare it.
    livePortions.data !== undefined &&
    foodChangedSinceLogged(liveFood.data, entry.snapshot, livePortions.data);

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
                      void entrySave.update({ entry, useCurrentFoodData: true });
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
      food={foodOfSnapshot(entry.snapshot, entry.created_at)}
      livePortions={
        livePortions.data === undefined
          ? undefined
          : { portions: livePortions.data, loggedPortionId: entry.portion_id }
      }
      // The picker keeps the amount and the unit it was opened with. When the entry's amount is no longer the
      // same thing (an update to the current food can replace the portion it was logged with, or land on
      // grams), the picker is opened afresh on the entry as it now is.
      key={`${entry.snapshot.unit}:${entry.portion_id ?? ""}`}
      hasSaveError={entrySave.hasSaveError}
      isNow={false}
      isOnline={isOnline}
      isSaving={entrySave.isSaving}
      mode="edit"
      snapshot={entry.snapshot}
      time={formatClockTime(new Date(entry.logged_at), timeZone)}
      onBack={onLeave}
      onDelete={() => {
        deleteWithUndo(entry);
        onLeave();
      }}
      onSubmit={(selection) => {
        const change = foodEntryChange(entry, selection, timeZone);
        void entrySave.save(change === null ? null : { entry, ...change });
      }}
    />
  );
}
