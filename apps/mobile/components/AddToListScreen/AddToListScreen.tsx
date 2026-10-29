import { keys, useAddRecipesToList, useRecipe, useShoppingPreview } from "@keylow/api-client";
import {
  FOOD_FORM,
  GENERIC_ERROR,
  OFFLINE_BANNER,
  RECIPE_EDITOR,
  RECIPE_VIEW,
  RETRY_LABEL,
  SHOPPING_LIST,
  describeAddAnyway,
  describeLeftOutCount,
  describeServingsValue,
  describeShoppingAmount,
} from "@keylow/core/copy";
import { enteredViewServings, isRecipeId, stepViewServings } from "@keylow/core/recipes";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { vars } from "nativewind";
import { useState } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useIsOnline } from "../../lib/connectivity";
import { recipePath, recipesPath } from "../../lib/recipeRoutes";
import { useReadsEnabled } from "../../lib/useReadsEnabled";
import { RecipeLoadState } from "../RecipeLoadState";
import {
  Banner,
  Button,
  Checkbox,
  ErrorState,
  GroupedList,
  ServingsStepper,
  SheetHeader,
  Skeleton,
  Text,
  useToast,
} from "../ui";

import type { AddToListScreenProps } from "./types";
import type { ShoppingDraft } from "@keylow/core/shopping";

// The space under the Add button, and the least room under it for the system bar, as the recipe view keeps.
const CONTENT_BOTTOM_GAP = 16;
const MINIMUM_BOTTOM_PADDING = 34;

type AddToListRecipe = { id: string; name: string; servings: number };

const amountOf = (draft: ShoppingDraft): string | undefined =>
  describeShoppingAmount({
    grams: draft.grams,
    portion_label: draft.portionLabel,
    portion_count: draft.portionCount,
  }) ?? undefined;

function DraftText({ draft }: { draft: ShoppingDraft }) {
  const amount = amountOf(draft);

  return (
    <View className="min-w-0 flex-1">
      <Text variant="body-strong">{draft.name}</Text>
      {amount === undefined ? null : (
        <Text tone="muted" variant="caption">
          {amount}
        </Text>
      )}
    </View>
  );
}

function AddToListBody({
  recipe,
  initialServings,
  onLeave,
}: {
  recipe: AddToListRecipe;
  initialServings: number;
  onLeave: () => void;
}) {
  const toast = useToast();
  const isOnline = useIsOnline();
  const insets = useSafeAreaInsets();
  const add = useAddRecipesToList();
  const [servings, setServings] = useState(initialServings);
  // What is in the field while it is being typed in, or null when it shows the servings in use.
  const [typedText, setTypedText] = useState<string | null>(null);
  // The staples the person chose to add anyway, by food. Nothing is kept once the screen goes.
  const [addAnyway, setAddAnyway] = useState<readonly string[]>([]);
  const state = useShoppingPreview([{ id: recipe.id, servings }]);
  const hasProblem = typedText !== null && enteredViewServings(typedText, recipe.servings) === null;

  function handleStep(direction: 1 | -1) {
    const next = stepViewServings(servings, direction === 1 ? "plus" : "minus");
    if (next !== null) {
      setServings(next);
      setTypedText(null);
    }
  }

  function handleChangeText(typed: string) {
    setTypedText(typed);
    const entered = enteredViewServings(typed, recipe.servings);
    if (entered !== null) {
      setServings(entered);
    }
  }

  function toggleStaple(foodId: string, checked: boolean) {
    setAddAnyway((chosen) =>
      checked ? [...chosen, foodId] : chosen.filter((chosenId) => chosenId !== foodId),
    );
  }

  const preview = state.status === "ready" ? state.preview : null;
  const chosenStaples = preview?.staples.filter(({ foodId }) => addAnyway.includes(foodId)) ?? [];
  const isNothingToAdd = preview === null || preview.items.length + chosenStaples.length === 0;

  function submit() {
    add.mutate(
      {
        recipes: [{ id: recipe.id, servings }],
        addAnyway: chosenStaples.map(({ foodId }) => foodId),
      },
      {
        onSuccess: () => {
          toast.show({ message: SHOPPING_LIST.added, icon: "Check", tone: "success" });
          onLeave();
        },
        onError: () => {
          toast.show({ message: SHOPPING_LIST.addFailed, icon: "CircleAlert", tone: "danger" });
        },
      },
    );
  }

  return (
    // The insets are runtime values no class can name, so they go through variables.
    <View
      className="flex-1 bg-background pt-[var(--inset-top)]"
      style={vars({
        "--inset-top": insets.top,
        "--content-bottom": CONTENT_BOTTOM_GAP + Math.max(insets.bottom, MINIMUM_BOTTOM_PADDING),
      })}
    >
      <SheetHeader
        leading={{ icon: "ChevronLeft", label: FOOD_FORM.back, onPress: onLeave }}
        subtitle={recipe.name}
        title={SHOPPING_LIST.addToList}
      />
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-4 px-4 pb-4 pt-1"
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
      >
        {isOnline ? null : (
          <Banner body={SHOPPING_LIST.offlineBody} title={OFFLINE_BANNER.title} variant="offline" />
        )}
        <ServingsStepper
          canDecrease={stepViewServings(servings, "minus") !== null}
          canIncrease={stepViewServings(servings, "plus") !== null}
          decreaseLabel={RECIPE_VIEW.fewerServings}
          error={hasProblem ? RECIPE_VIEW.servingsProblem : undefined}
          increaseLabel={RECIPE_VIEW.moreServings}
          label={RECIPE_EDITOR.servings}
          text={typedText ?? String(servings)}
          valueText={describeServingsValue(servings)}
          onBlur={() => {
            setTypedText(null);
          }}
          onChangeText={handleChangeText}
          onStep={handleStep}
        />

        {state.status === "loading" ? (
          <View accessible aria-label={SHOPPING_LIST.loadingLabel} role="status">
            <Skeleton rows={3} variant="group" />
          </View>
        ) : null}

        {state.status === "error" ? (
          <ErrorState retry={{ label: RETRY_LABEL, onPress: state.retry }} title={GENERIC_ERROR} />
        ) : null}

        {preview !== null && preview.items.length === 0 ? (
          <Text tone="secondary">{SHOPPING_LIST.onlyStaples}</Text>
        ) : null}

        {preview !== null && preview.items.length > 0 ? (
          <GroupedList title={SHOPPING_LIST.toBuy}>
            {preview.items.map((draft) => (
              <View key={draft.foodId} className="min-h-[52px] flex-row items-center px-4 py-2">
                <DraftText draft={draft} />
              </View>
            ))}
          </GroupedList>
        ) : null}

        {preview !== null && preview.staples.length > 0 ? (
          <GroupedList
            notice={
              <Text className="px-1" tone="muted" variant="caption">
                {describeLeftOutCount(preview.staples.length)}
              </Text>
            }
            title={SHOPPING_LIST.leftOut}
          >
            {preview.staples.map((draft) => (
              <View
                key={draft.foodId}
                className="min-h-[52px] flex-row items-center gap-3 px-4 py-1"
              >
                <DraftText draft={draft} />
                <View className="pt-2">
                  <Checkbox
                    accessibilityLabel={describeAddAnyway(draft.name)}
                    checked={addAnyway.includes(draft.foodId)}
                    label={SHOPPING_LIST.addAnyway}
                    onChange={(checked) => {
                      toggleStaple(draft.foodId, checked);
                    }}
                  />
                </View>
              </View>
            ))}
          </GroupedList>
        ) : null}
      </ScrollView>
      <View className="flex-row gap-2 px-4 pb-[var(--content-bottom)] pt-2">
        <View className="flex-1">
          <Button fullWidth variant="secondary" onPress={onLeave}>
            {SHOPPING_LIST.cancel}
          </Button>
        </View>
        <View className="flex-1">
          <Button
            disabled={!isOnline || isNothingToAdd || hasProblem}
            fullWidth
            haptic="confirm"
            loading={add.isPending}
            onPress={submit}
          >
            {SHOPPING_LIST.addItem}
          </Button>
        </View>
      </View>
    </View>
  );
}

/**
 * `/recipes/<id>/add-to-list`: adds a recipe's ingredients to the shopping list, pushed over the recipe
 * view or the list it came from. It starts at the servings the address carries, and the stepper changes
 * the amounts it shows and nothing else until Add is pressed. The store cupboard staples are left out,
 * listed under their own heading, and each can be added anyway. What is a staple and how the amounts add
 * up are core's. Add writes once, all or nothing, says so in a toast and goes back. A failure says so in
 * a toast and stays. The recipe is read with the loading, failed and not found states of the recipe view.
 */
export function AddToListScreen({ id, servingsText }: AddToListScreenProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const isOnline = useIsOnline();
  const isReadEnabled = useReadsEnabled();
  const isKnownToBeMissing = !isRecipeId(id);
  const state = useRecipe(isKnownToBeMissing ? undefined : id, { enabled: isReadEnabled });

  function leave() {
    // A cold link to this screen has nothing before it, so the user goes to the recipe, or to the library.
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(isKnownToBeMissing ? recipesPath() : recipePath(id));
    }
  }

  function renderState(loadState: "loading" | "error" | "notFound") {
    return (
      <RecipeLoadState
        state={loadState}
        onBack={leave}
        onRetry={() => {
          void queryClient.invalidateQueries({ queryKey: keys.recipes.detail(id) });
        }}
      />
    );
  }

  if (isKnownToBeMissing) {
    return renderState("notFound");
  }
  if (state.status === "error" || (state.status === "loading" && !isOnline)) {
    return renderState("error");
  }
  if (state.status === "loading" || !isReadEnabled) {
    return renderState("loading");
  }
  if (state.status === "notFound") {
    return renderState("notFound");
  }

  const { recipe } = state;

  return (
    <AddToListBody
      key={recipe.id}
      initialServings={enteredViewServings(servingsText ?? "", recipe.servings) ?? recipe.servings}
      recipe={{ id: recipe.id, name: recipe.name, servings: recipe.servings }}
      onLeave={leave}
    />
  );
}
