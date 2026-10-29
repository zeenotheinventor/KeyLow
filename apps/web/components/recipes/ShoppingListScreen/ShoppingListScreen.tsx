"use client";

import {
  useAddShoppingItem,
  useClearTickedItems,
  useRecipes,
  useRemoveShoppingItem,
  useShoppingList,
  useToggleShoppingItem,
} from "@keylow/api-client";
import { SHOPPING_LIST, SHOPPING_LIST_CLEAR_DIALOG } from "@keylow/core/copy";
import { CircleAlert } from "lucide-react";
import { useState } from "react";

import { AddToListDialog } from "../AddToListDialog";
import { RecipePickerDialog } from "../RecipePickerDialog";
import { ShoppingListView } from "../ShoppingListView";

import type { AddToListRecipe } from "../AddToListDialog";
import type { RecipePickerState } from "../RecipePickerDialog";

import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/Toast";
import { useIsOnline } from "@/lib/useIsOnline";

/**
 * The shopping list page: the list from `useShoppingList`, with ticking, removing and clearing done at
 * once and put back with a toast when the write fails. Add a recipe opens the picker over the live
 * recipes, and the recipe chosen opens the add dialog at its saved servings. A failed refetch keeps the
 * list already loaded, so only a page that never loaded is an error.
 */
export function ShoppingListScreen() {
  const isOnline = useIsOnline();
  const toast = useToast();
  const list = useShoppingList();
  const toggle = useToggleShoppingItem();
  const remove = useRemoveShoppingItem();
  const clear = useClearTickedItems();
  const addItem = useAddShoppingItem();
  const [isPicking, setIsPicking] = useState(false);
  const [isConfirmingClear, setIsConfirmingClear] = useState(false);
  const [adding, setAdding] = useState<AddToListRecipe | null>(null);
  // The picker reads the recipes only once it has been opened.
  const recipes = useRecipes({ archived: false, enabled: isPicking });

  const changeFailed = () => {
    toast.show({ message: SHOPPING_LIST.changeFailed, icon: CircleAlert, tone: "danger" });
  };

  const pickerState: RecipePickerState =
    recipes.data !== undefined
      ? { status: "ready", recipes: recipes.data.filter((recipe) => !recipe.is_archived) }
      : recipes.isError
        ? {
            status: "error",
            onRetry: () => {
              void recipes.refetch();
            },
          }
        : { status: "loading" };

  const view =
    list.data !== undefined ? (
      <ShoppingListView
        status="ready"
        items={list.data}
        isOnline={isOnline}
        isAddingItem={addItem.isPending}
        isClearing={clear.isPending}
        onToggle={(item, checked) => {
          toggle.mutate({ id: item.id, checked }, { onError: changeFailed });
        }}
        onRemove={(item) => {
          remove.mutate(item.id, { onError: changeFailed });
        }}
        onAddItem={(text, onAdded) => {
          addItem.mutate(text, {
            onSuccess: onAdded,
            onError: () => {
              toast.show({ message: SHOPPING_LIST.addFailed, icon: CircleAlert, tone: "danger" });
            },
          });
        }}
        onAddRecipe={() => {
          setIsPicking(true);
        }}
        onClearTicked={() => {
          setIsConfirmingClear(true);
        }}
      />
    ) : list.isError ? (
      <ShoppingListView
        status="error"
        onRetry={() => {
          void list.refetch();
        }}
      />
    ) : (
      <ShoppingListView status="loading" />
    );

  return (
    <>
      {view}
      <RecipePickerDialog
        open={isPicking}
        state={pickerState}
        onClose={() => {
          setIsPicking(false);
        }}
        onChoose={(recipe) => {
          setIsPicking(false);
          setAdding({ id: recipe.id, name: recipe.name, servings: recipe.servings });
        }}
      />
      <AddToListDialog
        open={adding !== null}
        recipe={adding}
        initialServings={adding?.servings ?? 1}
        onClose={() => {
          setAdding(null);
        }}
      />
      <Dialog
        open={isConfirmingClear}
        onClose={() => {
          setIsConfirmingClear(false);
        }}
        title={SHOPPING_LIST_CLEAR_DIALOG.title}
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setIsConfirmingClear(false);
              }}
            >
              {SHOPPING_LIST_CLEAR_DIALOG.cancelLabel}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={!isOnline}
              onClick={() => {
                setIsConfirmingClear(false);
                clear.mutate(undefined, { onError: changeFailed });
              }}
            >
              {SHOPPING_LIST_CLEAR_DIALOG.confirmLabel}
            </Button>
          </>
        }
      >
        <p className="text-body text-text-secondary">{SHOPPING_LIST_CLEAR_DIALOG.body}</p>
      </Dialog>
    </>
  );
}
