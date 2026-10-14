import { FOOD_DETAIL, FOOD_NOT_FOUND, FOOD_NOT_LOADED } from "@keylow/core/copy";
import { View } from "react-native";

import { FoodFormScreen } from "../FoodFormScreen";
import { EmptyState, ErrorState, Skeleton, Text } from "../ui";

import type { FoodLoadStateProps } from "./types";

function LoadStateBody({ state }: FoodLoadStateProps) {
  if (state === "error") {
    // The boards lift the words 96 points off the bottom, so they sit above the middle of the screen. 96 is
    // a board measure and not a step of the spacing scale, so it is written as it is drawn.
    return (
      <View className="flex-1 pb-[96px]">
        <ErrorState body={FOOD_NOT_LOADED.body} inset="wide" title={FOOD_NOT_LOADED.title} />
      </View>
    );
  }

  if (state === "notFound") {
    return (
      <View className="flex-1 pb-[96px]">
        <EmptyState
          body={FOOD_NOT_FOUND.body}
          icon="SearchX"
          inset="wide"
          title={FOOD_NOT_FOUND.title}
        />
      </View>
    );
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
 * What a food's screens show in place of a food that is loading, failed to load or does not exist, as
 * the food detail boards draw them: the "Food" header and the board's body under it. The detail, edit
 * and copy screens all use it. The failure itself is never shown, only its fixed sentence.
 */
export function FoodLoadState({ state }: FoodLoadStateProps) {
  return (
    <FoodFormScreen isTitleHeading={false} title={FOOD_DETAIL.title}>
      <LoadStateBody state={state} />
    </FoodFormScreen>
  );
}
