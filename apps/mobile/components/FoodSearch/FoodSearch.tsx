import { Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { describeEnergy } from "./describeEnergy";
import { describeRateLimit } from "./describeRateLimit";
import { FoodRow } from "./FoodRow";
import { LoadingStatus } from "./LoadingStatus";
import { foodSourceLabel } from "../../lib/foodSourceLabel";

import type { FoodSearchProps } from "./types";
import type { FoodSearchOffError } from "@keylow/api-client";

const MIN_QUERY_LENGTH = 2;

function describeOffError(error: FoodSearchOffError): string {
  return error.kind === "rate_limited"
    ? describeRateLimit(error.retryAfterSeconds)
    : "Open Food Facts could not be searched right now.";
}

export function FoodSearch({
  query,
  searchedQuery,
  onQueryChange,
  results,
  pendingCandidateCode,
  candidateError,
  onSelectFood,
  onSelectCandidate,
  onCreateFood,
}: FoodSearchProps) {
  const { local, off, isLoadingLocal, isLoadingOff, offError, localError } = results;
  const isSearchable = searchedQuery.length >= MIN_QUERY_LENGTH;
  const isAddingProduct = pendingCandidateCode !== undefined;
  const isEmpty =
    !isLoadingLocal &&
    !isLoadingOff &&
    localError === null &&
    local.length === 0 &&
    off.length === 0;

  return (
    <View className="flex-1 bg-neutral-50">
      <View className="gap-3 px-6 pb-2 pt-4">
        <TextInput
          accessibilityLabel="Search foods"
          accessibilityRole="search"
          placeholder="Name or brand"
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
          value={query}
          onChangeText={onQueryChange}
          className="h-12 rounded-lg border border-neutral-300 bg-neutral-50 px-4 text-base text-neutral-900"
        />
        {/* Other actions for finding a food, such as scanning a barcode, sit in this row. */}
        <View className="flex-row gap-2">
          <Pressable
            accessibilityRole="button"
            onPress={onCreateFood}
            className="h-12 items-center justify-center rounded-lg border border-neutral-300 px-4"
          >
            <Text className="text-base font-semibold text-neutral-900">Create a food</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="gap-4 px-6 py-4">
        {isSearchable ? null : (
          <Text className="text-base text-neutral-500">Type at least 2 characters to search</Text>
        )}

        {isSearchable && localError !== null ? (
          <Text accessibilityRole="alert" className="text-base text-danger-600">
            Your foods could not be searched. Check your connection and try again.
          </Text>
        ) : null}
        {isSearchable && isLoadingLocal ? <LoadingStatus label="Searching your foods" /> : null}
        {isSearchable && local.length > 0 ? (
          <View accessibilityRole="list" accessibilityLabel="Matching foods" className="gap-2">
            {local.map((food) => (
              <FoodRow
                key={food.id}
                name={food.name}
                brand={food.brand}
                sourceLabel={foodSourceLabel(food.source)}
                energyText={describeEnergy(food.kcal, food.basis)}
                onPress={() => {
                  onSelectFood(food.id);
                }}
              />
            ))}
          </View>
        ) : null}

        {isSearchable && isLoadingOff ? <LoadingStatus label="Searching Open Food Facts" /> : null}
        {isSearchable && offError !== null ? (
          <Text accessibilityRole="alert" className="text-base text-neutral-700">
            {describeOffError(offError)}
          </Text>
        ) : null}
        {isSearchable && off.length > 0 ? (
          <View className="gap-2">
            <Text accessibilityRole="header" className="text-lg font-semibold text-neutral-900">
              From Open Food Facts
            </Text>
            {candidateError === undefined ? null : (
              <Text accessibilityRole="alert" className="text-sm text-danger-600">
                {candidateError}
              </Text>
            )}
            <View
              accessibilityRole="list"
              accessibilityLabel="Open Food Facts results"
              className="gap-2"
            >
              {off.map((candidate) => (
                <FoodRow
                  key={candidate.code}
                  name={candidate.name}
                  brand={candidate.brand}
                  energyText={describeEnergy(candidate.kcal, candidate.basis)}
                  isDisabled={isAddingProduct}
                  {...(pendingCandidateCode === candidate.code
                    ? { statusText: "Adding to your foods" }
                    : {})}
                  onPress={() => {
                    onSelectCandidate(candidate.code);
                  }}
                />
              ))}
            </View>
          </View>
        ) : null}

        {isSearchable && isEmpty ? (
          <View className="gap-1">
            <Text className="text-lg font-semibold text-neutral-900">No foods found</Text>
            <Text className="text-base text-neutral-500">
              Try other words, or create the food yourself.
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
