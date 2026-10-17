import {
  FOOD_FORM,
  GENERIC_ERROR,
  RECIPE_EDITOR,
  RECIPE_NOT_FOUND,
  RETRY_LABEL,
} from "@keylow/core/copy";
import { vars } from "nativewind";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { EmptyState, ErrorState, SheetHeader, Skeleton } from "../ui";

import type { RecipeLoadStateProps } from "./types";

/**
 * What the recipe editor's route shows while the recipe loads, fails to load or is not there: the "Recipe"
 * header with Back, and the kit's skeleton, failure or empty state under it. The failure itself is never
 * shown, only its fixed sentence. The recipe view will show these states in its place.
 */
export function RecipeLoadState({ state, onBack, onRetry }: RecipeLoadStateProps) {
  const insets = useSafeAreaInsets();

  function renderBody() {
    if (state === "error") {
      return <ErrorState retry={{ label: RETRY_LABEL, onPress: onRetry }} title={GENERIC_ERROR} />;
    }
    if (state === "notFound") {
      return (
        <EmptyState body={RECIPE_NOT_FOUND.body} icon="SearchX" title={RECIPE_NOT_FOUND.title} />
      );
    }

    return (
      <View
        accessible
        aria-label={RECIPE_EDITOR.loadingLabel}
        aria-live="polite"
        className="px-4 pt-2"
        role="status"
      >
        <Skeleton variant="detail" />
      </View>
    );
  }

  return (
    // The top inset is a runtime value no class can name, so it goes through a variable.
    <View
      className="flex-1 bg-background pt-[var(--inset-top)]"
      style={vars({ "--inset-top": insets.top })}
    >
      <SheetHeader
        leading={{ icon: "ChevronLeft", label: FOOD_FORM.back, onPress: onBack }}
        title={RECIPE_EDITOR.loadingTitle}
      />
      {renderBody()}
    </View>
  );
}
