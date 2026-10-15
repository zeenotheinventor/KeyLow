import { useRecentFoods } from "@keylow/api-client";
import { LOG_SEARCH, RECENT_FOODS, describeLoggedAmount } from "@keylow/core/copy";
import { nutrientsOfSnapshot } from "@keylow/core/diary";
import { formatCalories } from "@keylow/core/format";
import { describeMacros } from "@keylow/core/search";

import { useReadsEnabled } from "../../../lib/useReadsEnabled";
import { EmptyState, FoodRow, GroupedList, Skeleton } from "../../ui";

import type { RecentFoodsProps } from "./types";

/**
 * The foods logged most recently, newest first, each with the amount it was last logged with and the
 * values for that amount. Its plus logs that amount again. With no history it says so. Nothing is read
 * until the account has accepted the current Terms.
 */
export function RecentFoods({ addDisabled, onAdd, onOpen }: RecentFoodsProps) {
  const recent = useRecentFoods({ enabled: useReadsEnabled() });

  if (recent.isError && recent.data === undefined) {
    // A quiet line in place of the list, so the sheet is never blank.
    return (
      <EmptyState
        body={LOG_SEARCH.recentFailed.body}
        icon="CloudOff"
        title={LOG_SEARCH.recentFailed.title}
      />
    );
  }

  if (recent.data === undefined) {
    return <Skeleton variant="group" />;
  }

  if (recent.data.length === 0) {
    return (
      <EmptyState body={RECENT_FOODS.empty.body} icon="Clock" title={RECENT_FOODS.empty.title} />
    );
  }

  return (
    <GroupedList source={RECENT_FOODS.caption} title={RECENT_FOODS.heading}>
      {recent.data.map((food) => {
        const { snapshot } = food;
        const nutrients = nutrientsOfSnapshot(snapshot);
        const macros = describeMacros(nutrients);

        return (
          <FoodRow
            key={food.foodId}
            caption={describeLoggedAmount(snapshot)}
            addDisabled={addDisabled}
            energy={nutrients.kcal === null ? undefined : formatCalories(nutrients.kcal)}
            layout="recent"
            macros={{
              protein: macros.protein ?? "-",
              carbs: macros.carbs ?? "-",
              fat: macros.fat ?? "-",
              description: macros.accessibleDescription,
            }}
            nameSegments={[{ text: snapshot.name, matched: false }]}
            onAdd={() => {
              onAdd(food);
            }}
            onPress={() => {
              onOpen(food);
            }}
          />
        );
      })}
    </GroupedList>
  );
}
