"use client";

import { MIN_SEARCH_LENGTH, useExerciseSearch } from "@keylow/api-client";
import {
  ADD_EXERCISE,
  describeCreateExerciseRow,
  describeExerciseGroupHeading,
} from "@keylow/core/copy";
import { CircleAlert, Plus, SearchX, WifiOff } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import type { AddExercisePickerProps } from "./types";
import type { ChosenExercise } from "../types";

import { ExerciseRow } from "@/components/train/ExerciseRow";
import { EmptyState } from "@/components/ui/EmptyState";
import { GroupedList } from "@/components/ui/GroupedList";
import { SearchField } from "@/components/ui/SearchField";
import { Skeleton } from "@/components/ui/Skeleton";
import { useIsOnline } from "@/lib/useIsOnline";

/**
 * What is inside the Add exercise dialog: the search and the results as the `session · add-exercise` board
 * draws them, "Your exercises" over "Library", with the `Create "..."` row under them when the caller can
 * create one. It is mounted only while the dialog is open, so the search starts empty each time. Under two
 * characters nothing is searched or drawn, and offline the search cannot run, so the offline line stands in
 * for the results.
 */
export function AddExercisePicker({ onChoose, onCreate }: AddExercisePickerProps) {
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const createTitleId = useId();
  const createHelpId = useId();
  // A second press while the dialog is closing must not choose the exercise again.
  const hasChosen = useRef(false);
  const isOnline = useIsOnline();
  const search = useExerciseSearch(query, { enabled: isOnline });
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
            key={exercise.id}
            name={exercise.name}
            equipment={exercise.equipment}
            isCustom={exercise.source === "user"}
            primaryMuscles={exercise.primary_muscles}
            secondaryMuscles={exercise.secondary_muscles}
            onAdd={() => {
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
      return <EmptyState icon={WifiOff} title={ADD_EXERCISE.exerciseSearchOffline} />;
    }
    if (!isSearched) {
      return null;
    }
    if (isWaiting) {
      return <Skeleton variant="rows" count={3} />;
    }
    if (hasFailed) {
      return (
        <EmptyState
          icon={CircleAlert}
          tone="danger"
          role="alert"
          title={ADD_EXERCISE.exerciseSearchFailed}
        />
      );
    }
    if (search.exercises.length === 0) {
      return <EmptyState icon={SearchX} title={ADD_EXERCISE.noResults} />;
    }
    return (
      <>
        {renderGroup("yours", yours)}
        {renderGroup("library", library)}
      </>
    );
  }

  // The dialog would put focus on its Close button, so the search takes it first: this effect runs before the
  // dialog's own, which leaves focus alone once it is inside the panel.
  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  const create = describeCreateExerciseRow(trimmedQuery);

  return (
    <div className="flex flex-col gap-3">
      <SearchField
        ref={searchRef}
        label={ADD_EXERCISE.searchName}
        placeholder={ADD_EXERCISE.searchName}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
        }}
        clear={{
          label: ADD_EXERCISE.clearSearchName,
          onClick: () => {
            setQuery("");
          },
        }}
      />
      {renderResults()}
      {isSearched && onCreate !== undefined && (
        <button
          type="button"
          aria-labelledby={createTitleId}
          aria-describedby={createHelpId}
          onClick={() => {
            onCreate(trimmedQuery);
          }}
          className="flex min-h-[52px] items-center gap-3 rounded-medium border border-dashed border-border-strong px-3 text-left text-text-primary outline-none hover:bg-hover-overlay active:bg-press-overlay focus-visible:ring-2 focus-visible:ring-focus-ring"
        >
          <Plus aria-hidden className="size-5 shrink-0 text-text-secondary" />
          <span className="flex flex-1 flex-col">
            <span id={createTitleId} className="text-body-strong">
              {create.title}
            </span>
            <span id={createHelpId} className="text-caption text-text-muted">
              {create.help}
            </span>
          </span>
        </button>
      )}
    </div>
  );
}
