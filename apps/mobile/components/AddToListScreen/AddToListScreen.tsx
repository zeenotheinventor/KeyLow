import { keys, useAddRecipesToList, useRecipe, useShoppingPreview } from "@keylow/api-client";
import {
  GENERIC_ERROR,
  RECIPE_EDITOR,
  RECIPE_VIEW,
  RETRY_LABEL,
  SHOPPING_LIST,
  describeServingsValue,
} from "@keylow/core/copy";
import { enteredViewServings, isRecipeId, stepViewServings } from "@keylow/core/recipes";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { View } from "react-native";

import { AddToListLayout } from "./AddToListLayout";
import { DraftGroups } from "./DraftGroups";
import { useIsOnline } from "../../lib/connectivity";
import { recipePath, recipesPath } from "../../lib/recipeRoutes";
import { useReadsEnabled } from "../../lib/useReadsEnabled";
import { RecipeLoadState } from "../RecipeLoadState";
import { ErrorState, ServingsStepper, Skeleton, useToast } from "../ui";

import type { AddToListScreenProps } from "./types";

type AddToListRecipe = { id: string; name: string; servings: number };

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

  // Set at once when Add is pressed, since two presses can come before the next render shows the write pending.
  const isWriting = useRef(false);

  function submit() {
    if (isWriting.current) {
      return;
    }
    isWriting.current = true;
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
        onSettled: () => {
          isWriting.current = false;
        },
        onError: () => {
          toast.show({ message: SHOPPING_LIST.addFailed, icon: "CircleAlert", tone: "danger" });
        },
      },
    );
  }

  return (
    <AddToListLayout
      canAdd={!isNothingToAdd && !hasProblem}
      isAdding={add.isPending}
      subtitle={recipe.name}
      onAdd={submit}
      onLeave={onLeave}
    >
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

      {preview === null ? null : (
        <DraftGroups addAnyway={addAnyway} preview={preview} onToggleStaple={toggleStaple} />
      )}
    </AddToListLayout>
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
