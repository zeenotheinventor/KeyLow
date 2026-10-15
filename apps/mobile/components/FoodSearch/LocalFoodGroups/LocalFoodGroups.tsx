import { SEARCH_GROUP_HEADINGS } from "@keylow/core/copy";
import { formatCalories } from "@keylow/core/format";
import { describeFoodRow, describeMacros, servingOfSearchHit } from "@keylow/core/search";

import { foodNeedsReview } from "../../../lib/foodNeedsReview";
import { FoodRow, GroupedList } from "../../ui";

import type { LocalFoodGroupsProps } from "./types";

/** The foods the local search found, one titled card per source, in the order the boards draw them. */
export function LocalFoodGroups({
  groups,
  query,
  logRows,
  onSeeMore,
  onOpenFood,
}: LocalFoodGroupsProps) {
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
        {group.visibleRows.map((food) => {
          const open = () => {
            onOpenFood(food.id);
          };
          if (logRows === undefined) {
            return <FoodRow key={food.id} {...describeFoodRow(food, query)} onPress={open} />;
          }
          // The rows come in the database's ranking and are drawn in it. The row shows one serving, and
          // its plus logs that serving.
          const { nameSegments, brand } = describeFoodRow(food, query);
          const serving = servingOfSearchHit(food);
          const macros = describeMacros(serving);

          return (
            <FoodRow
              key={food.id}
              addDisabled={logRows.addDisabled}
              brand={brand}
              caption={serving.caption}
              energy={serving.kcal === null ? undefined : formatCalories(serving.kcal)}
              layout="search"
              macros={{
                protein: macros.protein ?? "-",
                carbs: macros.carbs ?? "-",
                fat: macros.fat ?? "-",
                description: macros.accessibleDescription,
              }}
              nameSegments={nameSegments}
              needsReview={foodNeedsReview(food)}
              onAdd={() => {
                logRows.onAdd(food);
              }}
              onPress={open}
            />
          );
        })}
      </GroupedList>
    );
  });
}
