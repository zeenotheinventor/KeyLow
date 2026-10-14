"use client";

import { useOwnFoods } from "@keylow/api-client";
import {
  SEARCH_EMPTY,
  SEARCH_FAILED_WEB,
  VALUES_PER_100_G_NOTE,
  YOUR_FOODS_EMPTY,
} from "@keylow/core/copy";
import { groupFoodSearchResults } from "@keylow/core/search";
import { Plus, SearchX } from "lucide-react";

import { filterOwnFoods } from "../filterOwnFoods";
import { LocalFoodList } from "../LocalFoodList";

import type { OwnFoodResultsProps } from "./types";

import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";

const CREATE_A_FOOD_HREF = "/foods/new";

/**
 * The user's own foods, listed before anything is typed. Typing narrows the list here and never
 * reaches for the shared foods or Open Food Facts, as a library search stays in the library.
 */
export function OwnFoodResults({ query }: OwnFoodResultsProps) {
  const ownFoods = useOwnFoods();
  const trimmedQuery = query.trim();

  if (ownFoods.isPending) {
    return <Skeleton variant="rows" label="Loading your foods" />;
  }

  if (ownFoods.isError) {
    return (
      <ErrorState size="section" title={SEARCH_FAILED_WEB.title} body={SEARCH_FAILED_WEB.body} />
    );
  }

  if (ownFoods.data.length === 0) {
    return (
      <EmptyState
        icon={SearchX}
        title={YOUR_FOODS_EMPTY.title}
        body={YOUR_FOODS_EMPTY.body}
        action={{ label: YOUR_FOODS_EMPTY.action, icon: Plus, href: CREATE_A_FOOD_HREF }}
      />
    );
  }

  const foods = filterOwnFoods(ownFoods.data, trimmedQuery);

  if (foods.length === 0) {
    return (
      <EmptyState
        icon={SearchX}
        title={SEARCH_EMPTY.title}
        body={SEARCH_EMPTY.body}
        action={{ label: SEARCH_EMPTY.action, icon: Plus, href: CREATE_A_FOOD_HREF }}
      />
    );
  }

  return (
    <>
      <p className="-mb-2 text-caption text-text-muted">{VALUES_PER_100_G_NOTE}</p>
      <LocalFoodList
        groups={groupFoodSearchResults(foods, { limit: foods.length })}
        query={trimmedQuery}
      />
    </>
  );
}
