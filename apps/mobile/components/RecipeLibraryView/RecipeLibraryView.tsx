import {
  OFFLINE_BANNER,
  RECIPES_EMPTY,
  RECIPES_LIBRARY,
  RECIPES_LOADING_LABEL,
  RECIPES_LOAD_FAILED,
  RECIPES_OFFLINE,
  RECIPES_SEARCH_EMPTY,
  RETRY_LABEL,
  SEARCH_CLEAR_LABEL,
  TAB_TITLES,
  describeMoreForRecipe,
  describeRecipeCount,
} from "@keylow/core/copy";
import { filterRecipesByName } from "@keylow/core/search";
import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, ScrollView, View } from "react-native";

import { RecipeRowMenu } from "../RecipeRowMenu";
import { ScreenHeader } from "../ScreenHeader";
import {
  Banner,
  Button,
  Card,
  EmptyState,
  ErrorState,
  FoodRow,
  GroupedList,
  IconButton,
  ListRow,
  SearchField,
  Skeleton,
} from "../ui";
import { recipeRowFields } from "./recipeRowFields";

import type { RecipeLibraryViewProps } from "./types";
import type { RecipeSummary } from "@keylow/api-client";

// How long typing has to stop before the number of recipes found is read out, so a screen reader is not
// interrupted by every letter.
const ANNOUNCE_AFTER_TYPING_MS = 500;

// How many skeleton rows the loading board draws.
const LOADING_ROWS = 4;

// The boards lift the state 80 points above the bottom of the space, so it sits a little above the middle.
const stateClassName = "flex-1 pb-20";

/**
 * The Recipes tab's library, drawn from what it is given: the user's live recipes with a search over their
 * names, and its empty, loading, failed and offline states. The screen that reads the recipes is
 * `RecipeLibrary`. Typing filters the list from the first letter, and once typing stops the number of
 * recipes found is read out politely. Each row has a More button that opens its menu, and under the list
 * is the row that leads to the archived recipes, which a search hides.
 */
export function RecipeLibraryView(props: RecipeLibraryViewProps) {
  const [query, setQuery] = useState(props.initialQuery ?? "");
  const trimmedQuery = query.trim();
  // The recipe is kept when the menu closes, so its name is still there while the sheet slides away.
  const [menuRecipe, setMenuRecipe] = useState<RecipeSummary | undefined>(undefined);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  // A double tap on an item must act once, and the sheet is still on screen for the second tap.
  const hasChosenFromMenu = useRef(false);

  const recipes = props.status === "ready" ? props.recipes : [];
  const isOnline = props.status === "ready" ? (props.isOnline ?? true) : props.status !== "offline";
  const found = filterRecipesByName(recipes, trimmedQuery);
  const isEmpty = props.status === "ready" && recipes.length === 0;
  const showsField = props.status === "loading" || (props.status === "ready" && !isEmpty);
  const showsRows = props.status === "ready" && found.length > 0;
  const foundCount = found.length;
  const archivedCount = props.status === "ready" ? (props.archivedCount ?? 0) : 0;
  const showsArchivedLink = archivedCount > 0 && trimmedQuery === "";

  // Choosing an item closes the sheet and acts at once, once.
  const chooseFromMenu = (act: (recipe: RecipeSummary) => void) => {
    setIsMenuOpen(false);
    if (menuRecipe !== undefined && !hasChosenFromMenu.current) {
      hasChosenFromMenu.current = true;
      act(menuRecipe);
    }
  };

  useEffect(() => {
    if (trimmedQuery === "" || props.status !== "ready") {
      return undefined;
    }
    const timer = setTimeout(() => {
      AccessibilityInfo.announceForAccessibility(describeRecipeCount(foundCount));
    }, ANNOUNCE_AFTER_TYPING_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [trimmedQuery, foundCount, props.status]);

  const offlineBody =
    props.status === "offline" ? RECIPES_OFFLINE.body : RECIPES_OFFLINE.inMemoryBody;

  return (
    <View className="flex-1">
      <ScreenHeader
        title={TAB_TITLES.recipes}
        trailing={
          <Button
            disabled={!isOnline}
            icon="Plus"
            size="sm"
            variant="secondary"
            onPress={() => {
              props.onNewRecipe();
            }}
          >
            {RECIPES_LIBRARY.newRecipe}
          </Button>
        }
      />
      <ScrollView
        className="flex-1"
        contentContainerClassName="grow gap-3 px-4 pb-4 pt-1"
        keyboardShouldPersistTaps="handled"
      >
        {isOnline ? null : (
          <Banner body={offlineBody} title={OFFLINE_BANNER.title} variant="offline" />
        )}

        {showsField && (
          <SearchField
            clear={{
              label: SEARCH_CLEAR_LABEL,
              onPress: () => {
                setQuery("");
              },
            }}
            disabled={props.status === "loading"}
            label={RECIPES_LIBRARY.searchPlaceholder}
            placeholder={RECIPES_LIBRARY.searchPlaceholder}
            placement="inline"
            value={query}
            onChangeText={setQuery}
          />
        )}

        {props.status === "loading" && (
          <View accessible aria-label={RECIPES_LOADING_LABEL} aria-live="polite" role="status">
            <Skeleton rows={LOADING_ROWS} variant="recipeGroup" />
          </View>
        )}

        {props.status === "error" && (
          <View className={stateClassName}>
            <ErrorState
              body={RECIPES_LOAD_FAILED.body}
              retry={{ label: RETRY_LABEL, onPress: props.onRetry }}
              title={RECIPES_LOAD_FAILED.title}
            />
          </View>
        )}

        {isEmpty && (
          <View className={stateClassName}>
            <EmptyState
              action={{
                label: RECIPES_LIBRARY.newRecipe,
                icon: "Plus",
                variant: "primary",
                disabled: !isOnline,
                onPress: () => {
                  props.onNewRecipe();
                },
              }}
              body={RECIPES_EMPTY.body}
              icon="ChefHat"
              title={RECIPES_EMPTY.title}
            />
          </View>
        )}

        {props.status === "ready" && !isEmpty && found.length === 0 && (
          <View className={stateClassName}>
            <EmptyState
              action={{
                label: RECIPES_LIBRARY.newRecipe,
                icon: "Plus",
                disabled: !isOnline,
                onPress: () => {
                  props.onNewRecipe(trimmedQuery);
                },
              }}
              body={RECIPES_SEARCH_EMPTY.body}
              icon="SearchX"
              title={RECIPES_SEARCH_EMPTY.title}
            />
          </View>
        )}

        {showsRows && (
          <GroupedList hidesTitle title={TAB_TITLES.recipes}>
            {found.map((recipe) => (
              <FoodRow
                key={recipe.id}
                layout="recipe"
                {...recipeRowFields(recipe, trimmedQuery)}
                trailing={
                  <IconButton
                    className="mr-1"
                    disabled={!isOnline}
                    icon="Ellipsis"
                    label={describeMoreForRecipe(recipe.name)}
                    tone="secondary"
                    variant="ghost"
                    onPress={() => {
                      hasChosenFromMenu.current = false;
                      setMenuRecipe(recipe);
                      setIsMenuOpen(true);
                    }}
                  />
                }
                onPress={() => {
                  props.onOpenRecipe(recipe.id);
                }}
              />
            ))}
          </GroupedList>
        )}

        {showsArchivedLink && (
          <Card padding={0}>
            <ListRow
              icon="Archive"
              title={RECIPES_LIBRARY.archivedLink}
              value={String(archivedCount)}
              valueLook="quiet"
              onPress={props.onOpenArchived}
            />
          </Card>
        )}
      </ScrollView>

      {menuRecipe === undefined ? null : (
        <RecipeRowMenu
          open={isMenuOpen}
          recipeName={menuRecipe.name}
          onArchive={() => {
            chooseFromMenu(props.onArchiveRecipe);
          }}
          onClose={() => {
            setIsMenuOpen(false);
          }}
          onDuplicate={() => {
            chooseFromMenu(props.onDuplicateRecipe);
          }}
        />
      )}
    </View>
  );
}
