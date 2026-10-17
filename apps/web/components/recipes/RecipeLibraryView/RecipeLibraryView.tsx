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
  describeArchivedLink,
  describeArchivedLinkName,
  describeRecipeCount,
} from "@keylow/core/copy";
import { filterRecipesByName } from "@keylow/core/search";
import { iconStroke } from "@keylow/tokens";
import { Archive, ChefHat, Plus, SearchX } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { RecipeLibrarySkeleton } from "../RecipeLibrarySkeleton";
import { RecipeRowActions } from "../RecipeRowActions";
import { RecipeRows } from "../RecipeRows";
import { RECIPE_STATE_CLASSES } from "../stateClasses";

import type { RecipeLibraryViewProps } from "./types";

import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { SearchField } from "@/components/ui/SearchField";
import { archivedPath, newRecipePath } from "@/lib/recipeRoutes";

// How long typing has to stop before the number of recipes found is read out, so a screen reader is
// not interrupted by every letter.
const ANNOUNCE_AFTER_TYPING_MS = 500;

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
  const newRecipeLink = useRef<HTMLAnchorElement>(null);
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
  // The link is left out while a search narrows the list, as the search board draws it.
  const archivedCount = props.status === "ready" ? props.archivedCount : 0;
  const showsArchivedLink = archivedCount > 0 && trimmedQuery === "";

  return (
    <div className="mx-auto flex w-full max-w-[1132px] flex-col gap-5">
      <div className="flex flex-col items-stretch justify-between gap-3 md:flex-row md:items-center">
        <h1 className="text-h1">{TAB_TITLES.recipes}</h1>
        <Button asChild className="max-md:w-full">
          <Link ref={newRecipeLink} href={newRecipePath()}>
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
          className={RECIPE_STATE_CLASSES}
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
          className={RECIPE_STATE_CLASSES}
        />
      )}

      {props.status === "ready" && !isEmpty && found.length === 0 && (
        <EmptyState
          icon={SearchX}
          title={RECIPES_SEARCH_EMPTY.title}
          body={RECIPES_SEARCH_EMPTY.body}
          action={{ label: RECIPES_LIBRARY.newRecipe, icon: Plus, href: newRecipePath(query) }}
          className={RECIPE_STATE_CLASSES}
        />
      )}

      {props.status === "ready" && showsRows && (
        <RecipeRows
          recipes={found}
          query={trimmedQuery}
          opensRecipe
          renderButtons={(recipe, row) => (
            <RecipeRowActions
              name={recipe.name}
              layout={row.layout}
              isDuplicating={props.isDuplicating(recipe.id)}
              onDuplicate={() => {
                props.onDuplicate(recipe);
              }}
              archiveButtonRef={row.removeButtonRef}
              onArchive={() => {
                // The row is about to go, so focus is given to its neighbour first, or to New recipe
                // when it was the only one, rather than left to fall to the page.
                if (!row.moveFocusToNextRow()) {
                  newRecipeLink.current?.focus();
                }
                props.onArchive(recipe);
              }}
            />
          )}
        />
      )}

      {showsArchivedLink && (
        <Link
          href={archivedPath()}
          aria-label={describeArchivedLinkName(archivedCount)}
          className="inline-flex min-h-touch-target items-center gap-2 self-start rounded-small text-label-small text-accent-ink outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        >
          <Archive aria-hidden className="size-[18px]" strokeWidth={iconStroke} />
          {describeArchivedLink(archivedCount)}
        </Link>
      )}
    </div>
  );
}
