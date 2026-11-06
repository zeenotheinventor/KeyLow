import { useRecentFoods } from "@keylow/api-client";
import {
  LOG_SEARCH,
  RECENT_FOODS,
  SEARCH_IDLE,
  describeAddToPlateName,
  describeLoggedAmount,
} from "@keylow/core/copy";
import { nutrientsOfSnapshot, snapshotNeedsReview } from "@keylow/core/diary";
import { formatCalories } from "@keylow/core/format";
import { describeMacros } from "@keylow/core/search";
import { Clock, CloudOff } from "lucide-react";

import type { RecentFoodsProps } from "./types";

import { EmptyState } from "@/components/ui/EmptyState";
import { FoodRow } from "@/components/ui/FoodRow";
import { GroupedList } from "@/components/ui/GroupedList";
import { Skeleton } from "@/components/ui/Skeleton";

/**
 * The foods logged most recently, newest first, each with the amount it was last logged with and the values
 * for that amount, as the phone's Recent list. A row's plus puts that amount on the plate and a press on the row
 * opens it. A food that was missing a value when it was logged shows Needs review and a chevron, as a search
 * result does, so the plate never takes a food that cannot be logged.
 * With no history it says so, under the hint to type something to search for, which the list has no use for
 * while it has rows. A read that failed, or that is waiting for a connection with nothing cached,
 * says so in a quiet line in place of the rows, so the dialog is never blank and never an endless skeleton.
 */
export function RecentFoods({ addDisabled, onOpen, onAdd }: RecentFoodsProps) {
  const recent = useRecentFoods();

  if (recent.data === undefined) {
    return recent.isError || recent.fetchStatus === "paused" ? (
      <>
        <p className="text-caption text-text-muted">{SEARCH_IDLE.hint}</p>
        <EmptyState
          icon={CloudOff}
          size="list"
          title={LOG_SEARCH.recentFailed.title}
          body={LOG_SEARCH.recentFailed.body}
        />
      </>
    ) : (
      <Skeleton variant="rows" label="Loading recent foods" />
    );
  }

  if (recent.data.length === 0) {
    return (
      <>
        <p className="text-caption text-text-muted">{SEARCH_IDLE.hint}</p>
        <EmptyState
          icon={Clock}
          size="list"
          title={RECENT_FOODS.empty.title}
          body={RECENT_FOODS.empty.body}
        />
      </>
    );
  }

  return (
    <GroupedList title={RECENT_FOODS.heading} source={RECENT_FOODS.caption}>
      {recent.data.map((food) => {
        const { snapshot } = food;
        const nutrients = nutrientsOfSnapshot(snapshot);
        const macros = describeMacros(nutrients);
        const caption = describeLoggedAmount(snapshot);

        return (
          <FoodRow
            key={food.foodId}
            layout="search"
            // No search matched anything here, and the boards draw the whole name semibold, as the phone does:
            // the `search` layout gives a matched part that weight and an unmatched one the regular weight.
            nameSegments={[{ text: snapshot.name, matched: true }]}
            caption={caption}
            addLabel={describeAddToPlateName(snapshot.name, caption)}
            needsReview={snapshotNeedsReview(snapshot)}
            energy={nutrients.kcal === null ? undefined : formatCalories(nutrients.kcal)}
            macros={{
              protein: macros.protein ?? "-",
              carbs: macros.carbs ?? "-",
              fat: macros.fat ?? "-",
              description: macros.accessibleDescription,
            }}
            addDisabled={addDisabled}
            onClick={() => {
              onOpen(food);
            }}
            {...(onAdd === undefined
              ? {}
              : {
                  onAdd: () => {
                    onAdd(food);
                  },
                })}
          />
        );
      })}
    </GroupedList>
  );
}
