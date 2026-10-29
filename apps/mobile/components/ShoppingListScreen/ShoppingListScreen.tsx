import {
  useAddShoppingItem,
  useClearTickedItems,
  useRecipes,
  useRemoveShoppingItem,
  useShoppingList,
  useToggleShoppingItem,
} from "@keylow/api-client";
import {
  FOOD_FORM,
  GENERIC_ERROR,
  RECIPES_LIBRARY,
  RECIPES_LOADING_LABEL,
  RETRY_LABEL,
  SHOPPING_LIST,
  SHOPPING_LIST_CLEAR_DIALOG,
  SHOPPING_LIST_NO_RECIPES,
} from "@keylow/core/copy";
import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import { useIsOnline } from "../../lib/connectivity";
import { addToListPath, newRecipePath, recipesPath } from "../../lib/recipeRoutes";
import { useReadsEnabled } from "../../lib/useReadsEnabled";
import { ShoppingListView } from "../ShoppingListView";
import {
  BottomSheet,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  GroupedList,
  ListRow,
  SheetHeader,
  SheetScrollView,
  Skeleton,
  useToast,
} from "../ui";

import type { RecipeSummary } from "@keylow/api-client";

// The library can be long, so the sheet has a fixed height and its list scrolls.
const PICKER_SNAP_POINTS = ["70%"];

/**
 * `/recipes/shopping`: the list from `useShoppingList`, with ticking, removing and clearing done at once
 * and put back with a toast when the write fails. Add a recipe opens a sheet of the live recipes, and the
 * recipe chosen opens the add to list screen at its saved servings. Clearing the ticked items asks first.
 * A failed refetch keeps the list already loaded, so only a list that never loaded is an error, and a
 * phone offline with nothing in memory says so.
 */
export function ShoppingListScreen() {
  const router = useRouter();
  const toast = useToast();
  const isOnline = useIsOnline();
  const isReadEnabled = useReadsEnabled();
  const list = useShoppingList({ enabled: isReadEnabled });
  const toggle = useToggleShoppingItem();
  const remove = useRemoveShoppingItem();
  const clear = useClearTickedItems();
  const addItem = useAddShoppingItem();
  const [isPicking, setIsPicking] = useState(false);
  const [isConfirmingClear, setIsConfirmingClear] = useState(false);
  // The picker reads the recipes only once it has been opened.
  const recipes = useRecipes({ archived: false, enabled: isReadEnabled && isPicking });

  function goBack() {
    // A cold link to this screen has nothing before it, so Back goes to the library instead.
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(recipesPath());
    }
  }

  const changeFailed = () => {
    toast.show({ message: SHOPPING_LIST.changeFailed, icon: "CircleAlert", tone: "danger" });
  };

  function choose(recipe: RecipeSummary) {
    setIsPicking(false);
    router.push(addToListPath(recipe.id, recipe.servings));
  }

  function renderPicker() {
    if (recipes.data !== undefined) {
      const live = recipes.data.filter((recipe) => !recipe.is_archived);
      return live.length === 0 ? (
        <EmptyState
          action={{
            label: RECIPES_LIBRARY.newRecipe,
            icon: "Plus",
            onPress: () => {
              setIsPicking(false);
              router.push(newRecipePath());
            },
          }}
          body={SHOPPING_LIST_NO_RECIPES.body}
          icon="ChefHat"
          title={SHOPPING_LIST_NO_RECIPES.title}
        />
      ) : (
        <GroupedList hidesTitle title={SHOPPING_LIST.chooseRecipe}>
          {live.map((recipe) => (
            <ListRow
              key={recipe.id}
              title={recipe.name}
              onPress={() => {
                choose(recipe);
              }}
            />
          ))}
        </GroupedList>
      );
    }
    if (recipes.isError) {
      return (
        <ErrorState
          retry={{
            label: RETRY_LABEL,
            onPress: () => {
              void recipes.refetch();
            },
          }}
          title={GENERIC_ERROR}
        />
      );
    }
    return (
      <View accessible aria-label={RECIPES_LOADING_LABEL} role="status">
        <Skeleton rows={3} variant="group" />
      </View>
    );
  }

  function renderView() {
    if (list.data !== undefined) {
      return (
        <ShoppingListView
          isAddingItem={addItem.isPending}
          isOnline={isOnline}
          items={list.data}
          status="ready"
          onAddItem={(text, onAdded) => {
            addItem.mutate(text, {
              onSuccess: onAdded,
              onError: () => {
                toast.show({
                  message: SHOPPING_LIST.addFailed,
                  icon: "CircleAlert",
                  tone: "danger",
                });
              },
            });
          }}
          onAddRecipe={() => {
            setIsPicking(true);
          }}
          onBack={goBack}
          onClearTicked={() => {
            setIsConfirmingClear(true);
          }}
          onRemove={(item) => {
            remove.mutate(item.id, { onError: changeFailed });
          }}
          onToggle={(item, checked) => {
            toggle.mutate({ id: item.id, checked }, { onError: changeFailed });
          }}
        />
      );
    }
    if (!isOnline) {
      return <ShoppingListView status="offline" onBack={goBack} />;
    }
    if (list.isError) {
      return (
        <ShoppingListView
          status="error"
          onBack={goBack}
          onRetry={() => {
            void list.refetch();
          }}
        />
      );
    }
    return <ShoppingListView status="loading" onBack={goBack} />;
  }

  return (
    <>
      {renderView()}
      <BottomSheet
        label={SHOPPING_LIST.chooseRecipe}
        open={isPicking}
        snapPoints={PICKER_SNAP_POINTS}
        onClose={() => {
          setIsPicking(false);
        }}
      >
        {/* The header brings its own 16 points across, as the sheet does, so it is pulled out to its edge. */}
        <View className="-mx-4">
          <SheetHeader
            leading={{
              icon: "X",
              label: FOOD_FORM.close,
              onPress: () => {
                setIsPicking(false);
              },
            }}
            title={SHOPPING_LIST.chooseRecipe}
          />
        </View>
        <SheetScrollView className="flex-1" contentContainerClassName="pb-2">
          {renderPicker()}
        </SheetScrollView>
      </BottomSheet>
      <ConfirmDialog
        body={SHOPPING_LIST_CLEAR_DIALOG.body}
        cancelLabel={SHOPPING_LIST_CLEAR_DIALOG.cancelLabel}
        confirmLabel={SHOPPING_LIST_CLEAR_DIALOG.confirmLabel}
        open={isConfirmingClear}
        title={SHOPPING_LIST_CLEAR_DIALOG.title}
        tone="destructive"
        onCancel={() => {
          setIsConfirmingClear(false);
        }}
        onConfirm={() => {
          setIsConfirmingClear(false);
          clear.mutate(undefined, { onError: changeFailed });
        }}
      />
    </>
  );
}
