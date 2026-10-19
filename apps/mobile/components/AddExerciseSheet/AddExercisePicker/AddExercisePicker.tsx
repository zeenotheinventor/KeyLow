import { MIN_SEARCH_LENGTH, useExerciseSearch } from "@keylow/api-client";
import {
  ADD_EXERCISE,
  describeCreateExerciseRow,
  describeExerciseGroupHeading,
} from "@keylow/core/copy";
import { useRef, useState } from "react";
import { View } from "react-native";

import { useIsOnline } from "../../../lib/connectivity";
import { useReadsEnabled } from "../../../lib/useReadsEnabled";
import { ExerciseRow } from "../../ExerciseRow";
import {
  EmptyState,
  GroupedList,
  Icon,
  IconButton,
  PressableSurface,
  SearchField,
  SheetScrollView,
  Skeleton,
  Text,
} from "../../ui";

import type { AddExercisePickerProps } from "./types";
import type { ChosenExercise } from "../types";

/**
 * What is inside the Add exercise sheet: the title with Close, the search and the results as the
 * `session · add-exercise` board draws them, "Your exercises" over "Library", with the `Create "…"` row
 * under them when the caller can create one. It is mounted only while the sheet is open, so the search
 * starts empty each time. Under two characters nothing is searched or drawn, and offline the search cannot
 * run, so the offline line stands in for the results.
 */
export function AddExercisePicker({ onChoose, onClose, onCreate }: AddExercisePickerProps) {
  const [query, setQuery] = useState("");
  // A second press while the sheet is closing must not choose the exercise again.
  const hasChosen = useRef(false);
  const isOnline = useIsOnline();
  const enabled = useReadsEnabled() && isOnline;
  const search = useExerciseSearch(query, { enabled });
  const trimmedQuery = query.trim();
  const isSearched = isOnline && trimmedQuery.length >= MIN_SEARCH_LENGTH;
  const yours = search.exercises.filter((exercise) => exercise.source === "user");
  const library = search.exercises.filter((exercise) => exercise.source !== "user");
  const isWaiting = search.exercises.length === 0 && (search.isLoading || search.isDebouncing);
  const hasFailed = search.error !== null && search.exercises.length === 0;

  function renderGroup(heading: "yours" | "library", exercises: readonly ChosenExercise[]) {
    if (exercises.length === 0) {
      return null;
    }
    return (
      <GroupedList title={describeExerciseGroupHeading(heading, exercises.length)}>
        {exercises.map((exercise) => (
          <ExerciseRow
            equipment={exercise.equipment}
            isCustom={exercise.source === "user"}
            key={exercise.id}
            name={exercise.name}
            primaryMuscles={exercise.primary_muscles}
            secondaryMuscles={exercise.secondary_muscles}
            onPress={() => {
              if (hasChosen.current) {
                return;
              }
              hasChosen.current = true;
              onChoose(exercise);
            }}
          />
        ))}
      </GroupedList>
    );
  }

  function renderResults() {
    if (!isOnline) {
      return <EmptyState title={ADD_EXERCISE.exerciseSearchOffline} variant="card" />;
    }
    if (!isSearched) {
      return null;
    }
    if (isWaiting) {
      return <Skeleton rows={3} variant="group" />;
    }
    if (hasFailed) {
      return <EmptyState title={ADD_EXERCISE.exerciseSearchFailed} variant="card" />;
    }
    if (search.exercises.length === 0) {
      return <EmptyState title={ADD_EXERCISE.noResults} variant="card" />;
    }
    return (
      <>
        {renderGroup("yours", yours)}
        {renderGroup("library", library)}
      </>
    );
  }

  const create = describeCreateExerciseRow(trimmedQuery);

  return (
    <View className="flex-1 gap-3">
      <View className="flex-row items-center gap-2">
        <Text className="flex-1" role="heading" variant="h2">
          {ADD_EXERCISE.title}
        </Text>
        <IconButton icon="X" label={ADD_EXERCISE.closeName} variant="ghost" onPress={onClose} />
      </View>
      <SearchField
        autoFocus
        clear={{
          label: ADD_EXERCISE.clearSearchName,
          onPress: () => {
            setQuery("");
          },
        }}
        label={ADD_EXERCISE.searchName}
        placeholder={ADD_EXERCISE.searchName}
        placement="inline"
        value={query}
        onChangeText={setQuery}
      />
      <SheetScrollView
        className="flex-1"
        contentContainerClassName="gap-3 pb-2"
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
      >
        {renderResults()}
        {isSearched && onCreate !== undefined ? (
          <PressableSurface
            className="min-h-[52px] flex-row items-center gap-3 rounded-medium border border-dashed border-border-strong px-3"
            label={create.title}
            onPress={() => {
              onCreate(trimmedQuery);
            }}
          >
            <Icon name="Plus" tone="secondary" />
            <View className="flex-1">
              <Text variant="body-strong">{create.title}</Text>
              <Text tone="muted" variant="caption">
                {create.help}
              </Text>
            </View>
          </PressableSurface>
        ) : null}
      </SheetScrollView>
    </View>
  );
}
