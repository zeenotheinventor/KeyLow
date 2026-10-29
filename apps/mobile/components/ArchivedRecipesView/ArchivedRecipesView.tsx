import {
  ARCHIVED_RECIPES,
  FOOD_FORM,
  OFFLINE_BANNER,
  RECIPES_LOADING_LABEL,
  RECIPES_LOAD_FAILED,
  RECIPES_OFFLINE,
  RETRY_LABEL,
  describeRestoreRecipe,
} from "@keylow/core/copy";
import { vars } from "nativewind";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { recipeRowFields } from "../RecipeLibraryView";
import {
  Banner,
  Button,
  EmptyState,
  ErrorState,
  FoodRow,
  GroupedList,
  SheetHeader,
  Skeleton,
  Text,
} from "../ui";

import type { ArchivedRecipesViewProps } from "./types";

// How many skeleton rows the loading state draws, as the library does.
const LOADING_ROWS = 4;

// The boards lift a state 80 points above the bottom of the space, so it sits a little above the middle.
const stateClassName = "flex-1 pb-20";

/**
 * The archived recipes, pushed inside the More tab after the library so the tab bar stays: Back and the
 * title, a note on what archived means, and a card of the recipes with a Restore button each. The rows are not pressable,
 * because an archived recipe is restored before it is opened. With nothing left, the note stays over an
 * empty state.
 */
export function ArchivedRecipesView(props: ArchivedRecipesViewProps) {
  const insets = useSafeAreaInsets();
  const isOnline = props.status !== "ready" || (props.isOnline ?? true);

  function renderBody() {
    switch (props.status) {
      case "loading":
        return (
          <View accessible aria-label={RECIPES_LOADING_LABEL} aria-live="polite" role="status">
            <Skeleton rows={LOADING_ROWS} variant="recipeGroup" />
          </View>
        );
      case "error":
        return (
          <View className={stateClassName}>
            <ErrorState
              body={RECIPES_LOAD_FAILED.body}
              retry={{ label: RETRY_LABEL, onPress: props.onRetry }}
              title={RECIPES_LOAD_FAILED.title}
            />
          </View>
        );
      case "offline":
        return (
          <Banner body={RECIPES_OFFLINE.body} title={OFFLINE_BANNER.title} variant="offline" />
        );
      case "ready":
        return props.recipes.length === 0 ? (
          <View className={stateClassName}>
            <EmptyState icon="Archive" title={ARCHIVED_RECIPES.empty} />
          </View>
        ) : (
          <GroupedList hidesTitle title={ARCHIVED_RECIPES.title}>
            {props.recipes.map((recipe) => (
              <FoodRow
                key={recipe.id}
                layout="recipe"
                {...recipeRowFields(recipe, "")}
                // Nothing opens, so the name is not the library's, which ends in "open".
                openLabel={undefined}
                trailing={
                  <Button
                    accessibilityLabel={describeRestoreRecipe(recipe.name)}
                    className="mr-3"
                    disabled={!isOnline}
                    size="sm"
                    variant="secondary"
                    onPress={() => {
                      props.onRestore(recipe);
                    }}
                  >
                    {ARCHIVED_RECIPES.restore}
                  </Button>
                }
              />
            ))}
          </GroupedList>
        );
    }
  }

  return (
    // The top inset is a runtime value no class can name, so it goes through a variable, as the Targets screen's does.
    <View
      className="flex-1 bg-background pt-[var(--inset-top)]"
      style={vars({ "--inset-top": insets.top })}
    >
      <SheetHeader
        leading={{ icon: "ChevronLeft", label: FOOD_FORM.back, onPress: props.onBack }}
        title={ARCHIVED_RECIPES.title}
      />
      <ScrollView className="flex-1" contentContainerClassName="grow gap-3 px-4 pb-4 pt-1">
        {props.status === "ready" && !isOnline && (
          <Banner
            body={RECIPES_OFFLINE.inMemoryBody}
            title={OFFLINE_BANNER.title}
            variant="offline"
          />
        )}
        <Text className="px-1" tone="secondary" variant="caption">
          {ARCHIVED_RECIPES.note}
        </Text>
        {renderBody()}
      </ScrollView>
    </View>
  );
}
