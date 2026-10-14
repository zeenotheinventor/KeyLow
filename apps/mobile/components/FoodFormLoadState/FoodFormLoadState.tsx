import { FOOD_DETAIL, FOOD_NOT_FOUND, FOOD_NOT_LOADED } from "@keylow/core/copy";
import { View } from "react-native";

import { FoodFormScreen } from "../FoodFormScreen";
import { EmptyState, ErrorState, Skeleton, Text } from "../ui";

import type { FoodFormLoadStateProps } from "./types";

function LoadStateBody({ state }: FoodFormLoadStateProps) {
  if (state === "error") {
    return <ErrorState body={FOOD_NOT_LOADED.body} title={FOOD_NOT_LOADED.title} />;
  }

  if (state === "notFound") {
    return <EmptyState body={FOOD_NOT_FOUND.body} icon="SearchX" title={FOOD_NOT_FOUND.title} />;
  }

  return (
    <View
      accessible
      aria-label={FOOD_DETAIL.loading}
      aria-live="polite"
      className="flex-1 gap-4 px-4 pt-2"
      role="status"
    >
      <Skeleton variant="detail" />
      <Text tone="muted" variant="caption">
        {FOOD_DETAIL.loading}
      </Text>
    </View>
  );
}

/**
 * What the edit and copy screens show in place of a food that is loading, failed to load or does not
 * exist, as the food detail boards draw them: the "Food" header and the board's body under it. The
 * failure itself is never shown, only its fixed sentence.
 */
export function FoodFormLoadState({ state }: FoodFormLoadStateProps) {
  return (
    <FoodFormScreen isTitleHeading={false} title={FOOD_DETAIL.title}>
      <LoadStateBody state={state} />
    </FoodFormScreen>
  );
}
