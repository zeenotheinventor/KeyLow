import { keys, useRecipeRefreshPreview, useRefreshRecipeIngredients } from "@keylow/api-client";
import {
  DIARY_LOAD_FAILED,
  FOOD_FORM,
  RECIPE_ACTIONS,
  RECIPE_NOT_FOUND,
  RECIPE_TOASTS,
  REFRESH,
  RETRY_LABEL,
  SAVE_FAILED_BANNER,
} from "@keylow/core/copy";
import { isRecipeId } from "@keylow/core/recipes";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { usePreventRemove } from "expo-router/react-navigation";
import { vars } from "nativewind";
import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useIsOnline } from "../../lib/connectivity";
import { recipePath, recipesPath } from "../../lib/recipeRoutes";
import { useReadsEnabled } from "../../lib/useReadsEnabled";
import { RecipeRefreshContent } from "../RecipeRefreshContent";
import { Banner, EmptyState, ErrorState, SheetHeader, Skeleton, useToast } from "../ui";

import type { RecipeRefreshScreenProps } from "./types";
import type { RecipeRefreshDiff } from "@keylow/api-client";

function leaveScreen(router: ReturnType<typeof useRouter>, fallbackPath: string) {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace(fallbackPath);
  }
}

/**
 * `/recipes/<id>/refresh`: checks the recipe's foods afresh each time it opens, shows what Apply would change
 * and saves it on Apply, then goes back to the view with the toast "Ingredients refreshed". The view stays
 * beneath it, so the servings chosen there are untouched. Close and Cancel leave with nothing written. The
 * screen goes back as soon as the save has worked, and never because of what the preview says afterwards:
 * the save refreshes the preview too, which would read "Nothing to refresh" before the screen had gone, so
 * the diff Apply was pressed on stays on screen until it goes. A failed save says one fixed sentence under
 * the header and leaves Apply ready to press again. Offline, Apply is dimmed. No failure is ever shown as
 * its own text, since it can quote a recipe.
 */
export function RecipeRefreshScreen({ id }: RecipeRefreshScreenProps) {
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const isOnline = useIsOnline();
  const isReadEnabled = useReadsEnabled();
  const insets = useSafeAreaInsets();
  const isKnownToBeMissing = !isRecipeId(id);
  const preview = useRecipeRefreshPreview(isKnownToBeMissing ? undefined : id, {
    enabled: isReadEnabled,
  });
  const refreshIngredients = useRefreshRecipeIngredients();
  const introRef = useRef<View>(null);
  const isApplyingNow = useRef(false);
  // Set once the save has worked: the screen is on its way out, but is still up until the pop ends.
  const hasAppliedRef = useRef(false);
  const [isApplying, setIsApplying] = useState(false);
  const [hasApplyFailed, setHasApplyFailed] = useState(false);
  const [hasApplied, setHasApplied] = useState(false);
  // The diff Apply was pressed on, kept on screen until the screen goes, whatever the preview reads by then.
  const [appliedDiff, setAppliedDiff] = useState<RecipeRefreshDiff | null>(null);

  // A cold link to this screen has nothing before it, so the user goes to the recipe, or to the library.
  const fallbackPath = isKnownToBeMissing ? recipesPath() : recipePath(id);
  const shownDiff =
    appliedDiff ?? (isReadEnabled && preview.status === "ready" ? preview.diff : null);

  // A save under way is not interrupted by the back button or the swipe back. The way out runs after the
  // render that lifted the hold, or the navigator would still refuse it.
  usePreventRemove(isApplying, () => undefined);

  useEffect(() => {
    if (hasApplied) {
      leaveScreen(router, fallbackPath);
    }
  }, [hasApplied, router, fallbackPath]);

  // The change is read before the buttons: a screen reader starts on the intro once there is a diff.
  const hasChanges = shownDiff?.hasChanges === true;
  useEffect(() => {
    if (hasChanges && introRef.current !== null) {
      AccessibilityInfo.sendAccessibilityEvent(introRef.current, "focus");
    }
  }, [hasChanges]);

  function leave() {
    if (!isApplyingNow.current && !hasAppliedRef.current) {
      leaveScreen(router, fallbackPath);
    }
  }

  async function apply() {
    if (isApplyingNow.current || hasAppliedRef.current || !isOnline || shownDiff === null) {
      return;
    }
    isApplyingNow.current = true;
    setIsApplying(true);
    setHasApplyFailed(false);
    setAppliedDiff(shownDiff);
    try {
      await refreshIngredients.mutateAsync(id);
      toast.show({ message: RECIPE_TOASTS.refreshed, tone: "success", icon: "Check" });
      hasAppliedRef.current = true;
      setHasApplied(true);
    } catch {
      setHasApplyFailed(true);
      setAppliedDiff(null);
    } finally {
      isApplyingNow.current = false;
      setIsApplying(false);
    }
  }

  function retry() {
    void queryClient.invalidateQueries({ queryKey: keys.recipes.refresh(id) });
  }

  function renderBody() {
    if (shownDiff !== null) {
      return (
        <RecipeRefreshContent
          diff={shownDiff}
          introRef={introRef}
          isApplying={isApplying}
          isOnline={isOnline}
          onApply={() => {
            void apply();
          }}
          onCancel={leave}
        />
      );
    }
    if (isKnownToBeMissing || preview.status === "notFound") {
      return (
        <EmptyState body={RECIPE_NOT_FOUND.body} icon="SearchX" title={RECIPE_NOT_FOUND.title} />
      );
    }
    if (preview.status === "error" || (preview.status === "loading" && !isOnline)) {
      return (
        <ErrorState
          body={DIARY_LOAD_FAILED.body}
          retry={{ label: RETRY_LABEL, onPress: retry }}
          title={REFRESH.loadFailed}
        />
      );
    }

    return (
      <View
        accessible
        aria-label={REFRESH.loadingLabel}
        aria-live="polite"
        className="px-4 pt-1"
        role="status"
      >
        <Skeleton variant="recipeRefresh" />
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
        leading={{ icon: "X", label: FOOD_FORM.close, disabled: isApplying, onPress: leave }}
        title={RECIPE_ACTIONS.refresh}
      />
      {hasApplyFailed ? (
        <View className="px-4 pb-3">
          <Banner sentence title={SAVE_FAILED_BANNER} variant="error" />
        </View>
      ) : null}
      {renderBody()}
    </View>
  );
}
