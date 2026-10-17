import { SEARCH_GROUP_HEADINGS, describeChooseAmountRowName } from "@keylow/core/copy";
import { foodNeedsReview } from "@keylow/core/diary";
import { formatCalories } from "@keylow/core/format";
import { describeFoodRow, describeMacros, servingOfSearchHit } from "@keylow/core/search";

import { FoodRow, GroupedList } from "../../ui";
import { RecipeLogGroup } from "../RecipeLogGroup";

import type { LocalFoodGroupsProps } from "./types";

/** The recipes and foods the local search found, one titled card per source, in the order the boards draw them: recipes first, in the log search. */
export function LocalFoodGroups({
  groups,
  query,
  logRows,
  choosesAmount = false,
  onSeeMore,
  onOpenFood,
}: LocalFoodGroupsProps) {
  const foodGroups = groups.map((group) => {
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
          if (logRows === undefined && !choosesAmount) {
            return <FoodRow key={food.id} {...describeFoodRow(food, query)} onPress={open} />;
          }
          // The rows come in the database's ranking and are drawn in it. The row shows one serving. In the log
          // search its plus logs that serving; in the ingredient search the row only opens the amount step,
          // because the amount matters in a recipe, and a screen reader is told so.
          const { nameSegments, brand } = describeFoodRow(food, query);
          const serving = servingOfSearchHit(food);
          const macros = describeMacros(serving);

          return (
            <FoodRow
              key={food.id}
              addDisabled={logRows?.addDisabled}
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
              openLabel={
                choosesAmount
                  ? describeChooseAmountRowName(food.name, serving.caption, {
                      brand,
                      needsReview: foodNeedsReview(food),
                    })
                  : undefined
              }
              onAdd={
                logRows === undefined
                  ? undefined
                  : () => {
                      logRows.onAdd(food);
                    }
              }
              onPress={open}
            />
          );
        })}
      </GroupedList>
    );
  });

  return (
    <>
      {logRows?.recipes === undefined || logRows.recipes.rows.length === 0 ? null : (
        <RecipeLogGroup
          addDisabled={logRows.addDisabled}
          query={query}
          recipes={logRows.recipes.rows}
          onAdd={logRows.recipes.onAdd}
        />
      )}
      {foodGroups}
    </>
  );
}
