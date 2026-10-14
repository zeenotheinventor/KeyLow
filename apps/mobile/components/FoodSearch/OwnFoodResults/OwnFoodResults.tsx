import { useOwnFoods } from "@keylow/api-client";
import {
  SEARCH_EMPTY,
  SEARCH_FAILED_MOBILE,
  SEARCH_GROUP_HEADINGS,
  VALUES_PER_100_G_NOTE,
  YOUR_FOODS_EMPTY,
} from "@keylow/core/copy";

import { EmptyState, ErrorState, FoodRow, GroupedList, Skeleton, Text } from "../../ui";
import { filterOwnFoods } from "../filterOwnFoods";
import { toFoodRowProps } from "../toFoodRowProps";

import type { OwnFoodResultsProps } from "./types";

/**
 * The user's own foods, listed before anything is typed. Typing narrows the list here and never reaches
 * for the shared foods or Open Food Facts, as a library search stays in the library.
 */
export function OwnFoodResults({ query, onOpenFood, onCreateFood }: OwnFoodResultsProps) {
  const ownFoods = useOwnFoods();
  const trimmedQuery = query.trim();
  const { title, caption } = SEARCH_GROUP_HEADINGS.yours;

  // A failed refetch keeps the list that was loaded, so only a list that never loaded is an error.
  if (ownFoods.data === undefined) {
    return ownFoods.isError ? (
      <ErrorState body={SEARCH_FAILED_MOBILE.body} title={SEARCH_FAILED_MOBILE.title} />
    ) : (
      <Skeleton variant="group" />
    );
  }

  if (ownFoods.data.length === 0) {
    return (
      <EmptyState
        action={{ label: YOUR_FOODS_EMPTY.action, icon: "Plus", onPress: onCreateFood }}
        body={YOUR_FOODS_EMPTY.body}
        icon="Apple"
        title={YOUR_FOODS_EMPTY.title}
      />
    );
  }

  const foods = filterOwnFoods(ownFoods.data, trimmedQuery);

  if (foods.length === 0) {
    return (
      <EmptyState
        action={{ label: SEARCH_EMPTY.action, icon: "Plus", onPress: onCreateFood }}
        body={SEARCH_EMPTY.body}
        icon="SearchX"
        title={SEARCH_EMPTY.title}
      />
    );
  }

  return (
    <>
      <Text className="-mb-2" tone="muted" variant="caption">
        {VALUES_PER_100_G_NOTE}
      </Text>
      <GroupedList source={caption} title={title}>
        {foods.map((food) => (
          <FoodRow
            key={food.id}
            {...toFoodRowProps(food, trimmedQuery)}
            onPress={() => {
              onOpenFood(food.id);
            }}
          />
        ))}
      </GroupedList>
    </>
  );
}
