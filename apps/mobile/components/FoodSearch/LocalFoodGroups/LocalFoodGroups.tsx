import { SEARCH_GROUP_HEADINGS } from "@keylow/core/copy";
import { describeFoodRow } from "@keylow/core/search";

import { FoodRow, GroupedList } from "../../ui";

import type { LocalFoodGroupsProps } from "./types";

/** The foods the local search found, one titled card per source, in the order the boards draw them. */
export function LocalFoodGroups({ groups, query, onSeeMore, onOpenFood }: LocalFoodGroupsProps) {
  return groups.map((group) => {
    const { title, caption } = SEARCH_GROUP_HEADINGS[group.key];

    return (
      <GroupedList
        key={group.key}
        seeMore={{
          hiddenCount: group.hiddenCount,
          onPress: () => {
            onSeeMore(group.key);
          },
        }}
        source={caption}
        title={title}
      >
        {group.visibleRows.map((food) => (
          <FoodRow
            key={food.id}
            {...describeFoodRow(food, query)}
            onPress={() => {
              onOpenFood(food.id);
            }}
          />
        ))}
      </GroupedList>
    );
  });
}
