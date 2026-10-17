"use client";

import {
  RECIPES_EMPTY,
  RECIPES_LIBRARY,
  RECIPES_LOADING_LABEL,
  RECIPES_LOAD_FAILED,
  RECIPES_SEARCH_EMPTY,
  RETRY_LABEL,
  SEARCH_CLEAR_LABEL,
  TAB_TITLES,
  describeRecipeCount,
} from "@keylow/core/copy";
import { filterRecipesByName } from "@keylow/core/search";
import { iconStroke } from "@keylow/tokens";
import { ChefHat, Plus, SearchX } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { RecipeLibrarySkeleton } from "../RecipeLibrarySkeleton";
import { recipeRowFields } from "./recipeRowFields";

import type { RecipeLibraryViewProps } from "./types";
import type { RecipeSummary } from "@keylow/api-client";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { FoodRow } from "@/components/ui/FoodRow";
import { FoodTable } from "@/components/ui/FoodTable";
import { SearchField } from "@/components/ui/SearchField";
import { newRecipePath, recipePath } from "@/lib/recipeRoutes";

// How long typing has to stop before the number of recipes found is read out, so a screen reader is
// not interrupted by every letter.
const ANNOUNCE_AFTER_TYPING_MS = 500;

// The boards centre the state in a 420 px block with no card around it, and add 120 px of padding below
// that block, so the state sits a little above the middle of the space.
const STATE_CLASSES =
  "box-content min-h-[420px] justify-center border-0 bg-transparent px-6 py-0 pb-[120px]";

const TABLE_LABEL = "Recipes";

function Rows({ recipes, query }: { recipes: readonly RecipeSummary[]; query: string }) {
  return (
    <>
      <Card padding="none" className="max-lg:hidden">
        <FoodTable variant="recipe" label={TABLE_LABEL}>
          {recipes.map((recipe) => {
            const row = recipeRowFields(recipe, query);

            return (
              <FoodRow
                key={recipe.id}
                layout="recipeTable"
                nameSegments={row.nameSegments}
                href={recipePath(recipe.id)}
                servingCaption={row.servingCaption}
                servings={row.servings}
                energy={row.energy}
                macros={row.cellMacros}
              />
            );
          })}
        </FoodTable>
      </Card>
      <Card asChild padding="none" className="lg:hidden">
        <ul aria-label={TABLE_LABEL} className="divide-y divide-border">
          {recipes.map((recipe) => {
            const row = recipeRowFields(recipe, query);

            return (
              <FoodRow
                key={recipe.id}
                layout="recipe"
                nameSegments={row.nameSegments}
                href={recipePath(recipe.id)}
                openLabel={row.openLabel}
                caption={row.caption}
                energy={row.energy}
                macros={row.macros}
              />
            );
          })}
        </ul>
      </Card>
    </>
  );
}

/**
 * The recipe library page, drawn from what it is given: the user's live recipes with a search over
 * their names, and its empty, loading and failed states. The page that reads the recipes is
 * `RecipeLibrary`. Typing filters the list from the first letter, and once typing stops the number of
 * recipes found is read out politely.
 */
export function RecipeLibraryView(props: RecipeLibraryViewProps) {
  const [query, setQuery] = useState("");
  const [announcedQuery, setAnnouncedQuery] = useState("");
  const searchField = useRef<HTMLInputElement>(null);
  const trimmedQuery = query.trim();

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnnouncedQuery(trimmedQuery);
    }, ANNOUNCE_AFTER_TYPING_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [trimmedQuery]);

  const recipes = props.status === "ready" ? props.recipes : [];
  const isEmpty = props.status === "ready" && recipes.length === 0;
  const found = filterRecipesByName(recipes, query);
  const showsField = props.status === "loading" || (props.status === "ready" && !isEmpty);
  const showsRows = props.status === "ready" && found.length > 0;
  const announcement =
    announcedQuery === ""
      ? ""
      : describeRecipeCount(filterRecipesByName(recipes, announcedQuery).length);

  return (
    <div className="mx-auto flex w-full max-w-[1132px] flex-col gap-5">
      <div className="flex flex-col items-stretch justify-between gap-3 md:flex-row md:items-center">
        <h1 className="text-h1">{TAB_TITLES.recipes}</h1>
        <Button asChild className="max-md:w-full">
          <Link href={newRecipePath()}>
            <Plus aria-hidden strokeWidth={iconStroke} />
            {RECIPES_LIBRARY.newRecipe}
          </Link>
        </Button>
      </div>

      {showsField && (
        <SearchField
          ref={searchField}
          label={RECIPES_LIBRARY.searchPlaceholder}
          placeholder={RECIPES_LIBRARY.searchPlaceholder}
          autoComplete="off"
          disabled={props.status === "loading"}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
          }}
          clear={{
            label: SEARCH_CLEAR_LABEL,
            onClick: () => {
              setQuery("");
              searchField.current?.focus();
            },
          }}
          className="w-full pl-3 md:w-[360px]"
        />
      )}
      {props.status === "ready" && showsField && (
        <p role="status" className="sr-only">
          {announcement}
        </p>
      )}

      {(props.status === "loading" || showsRows) && (
        <p className="-mb-3 text-caption text-text-muted">{RECIPES_LIBRARY.perServingNote}</p>
      )}

      {props.status === "loading" && <RecipeLibrarySkeleton label={RECIPES_LOADING_LABEL} />}

      {props.status === "error" && (
        <ErrorState
          title={RECIPES_LOAD_FAILED.title}
          body={RECIPES_LOAD_FAILED.body}
          retryLabel={RETRY_LABEL}
          onRetry={props.onRetry}
          className={STATE_CLASSES}
        />
      )}

      {isEmpty && (
        <EmptyState
          icon={ChefHat}
          title={RECIPES_EMPTY.title}
          body={RECIPES_EMPTY.body}
          action={{
            label: RECIPES_LIBRARY.newRecipe,
            icon: Plus,
            variant: "primary",
            href: newRecipePath(),
          }}
          className={STATE_CLASSES}
        />
      )}

      {props.status === "ready" && !isEmpty && found.length === 0 && (
        <EmptyState
          icon={SearchX}
          title={RECIPES_SEARCH_EMPTY.title}
          body={RECIPES_SEARCH_EMPTY.body}
          action={{ label: RECIPES_LIBRARY.newRecipe, icon: Plus, href: newRecipePath(query) }}
          className={STATE_CLASSES}
        />
      )}

      {showsRows && <Rows recipes={found} query={trimmedQuery} />}
    </div>
  );
}
