import { SEARCH_GROUP_HEADINGS } from "@keylow/core/copy";

import type { LocalFoodListProps } from "./types";

import { toFoodRowContent } from "@/components/foods/FoodSearch/foodRowContent";
import { FoodRow } from "@/components/ui/FoodRow";
import { GroupedList } from "@/components/ui/GroupedList";

/** The foods the local search found, one titled card per source. Each row opens its food. */
export function LocalFoodList({ groups, query, onSeeMore }: LocalFoodListProps) {
  return groups.map((group) => {
    const { title, caption } = SEARCH_GROUP_HEADINGS[group.key];

    return (
      <GroupedList
        key={group.key}
        title={title}
        source={caption}
        {...(onSeeMore === undefined
          ? {}
          : {
              seeMore: {
                hiddenCount: group.hiddenCount,
                onClick: () => {
                  onSeeMore(group.key);
                },
              },
            })}
      >
        {group.visibleRows.map((food) => (
          <FoodRow key={food.id} href={`/foods/${food.id}`} {...toFoodRowContent(food, query)} />
        ))}
      </GroupedList>
    );
  });
}
