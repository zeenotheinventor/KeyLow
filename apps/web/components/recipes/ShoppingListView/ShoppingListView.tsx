"use client";

import {
  GENERIC_ERROR,
  OFFLINE_BANNER,
  RETRY_LABEL,
  SHOPPING_LIST,
  SHOPPING_LIST_EMPTY,
} from "@keylow/core/copy";
import { groupShoppingList } from "@keylow/core/shopping";
import { iconStroke } from "@keylow/tokens";
import { ChefHat, Plus, ShoppingCart, WifiOff } from "lucide-react";
import { useState } from "react";

import { ShoppingItemRow } from "../ShoppingItemRow";
import { RECIPE_STATE_CLASSES } from "../stateClasses";

import type { ShoppingListViewProps } from "./types";

import { BackToFoodsLink } from "@/components/foods/FoodDetail";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { GroupedList } from "@/components/ui/GroupedList";
import { TextField } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { recipesPath } from "@/lib/recipeRoutes";

function AddItemForm({
  disabled,
  isAdding,
  onAdd,
}: {
  disabled: boolean;
  isAdding: boolean;
  onAdd: (text: string, onAdded: () => void) => void;
}) {
  const [text, setText] = useState("");

  return (
    <form
      className="flex items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        onAdd(text, () => {
          setText("");
        });
      }}
    >
      <div className="min-w-0 flex-1">
        <TextField
          label={SHOPPING_LIST.addItemPlaceholder}
          placeholder={SHOPPING_LIST.addItemPlaceholder}
          autoComplete="off"
          disabled={disabled}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
          }}
        />
      </div>
      <Button type="submit" variant="secondary" loading={isAdding} disabled={disabled}>
        <Plus aria-hidden strokeWidth={iconStroke} />
        {SHOPPING_LIST.addItem}
      </Button>
    </form>
  );
}

/**
 * The shopping list page, drawn from what it is given: what is still to buy, then what is ticked, a
 * field to add an item by hand, and Add a recipe, which opens the picker. The page that reads and
 * writes the list is `ShoppingListScreen`. Which items are to buy and their order are core's
 * (`groupShoppingList`). Ticked items stay at the bottom until Clear ticked items, which asks first.
 */
export function ShoppingListView(props: ShoppingListViewProps) {
  const groups = props.status === "ready" ? groupShoppingList(props.items) : null;
  const isOnline = props.status !== "ready" || props.isOnline;

  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col gap-5">
      <BackToFoodsLink tone="accent" label={SHOPPING_LIST.backToRecipes} href={recipesPath()} />
      <div className="flex flex-col items-stretch justify-between gap-3 md:flex-row md:items-center">
        <h1 className="text-h1">{SHOPPING_LIST.title}</h1>
        {props.status === "ready" && (
          <Button
            type="button"
            className="max-md:w-full"
            disabled={!isOnline}
            onClick={props.onAddRecipe}
          >
            <ChefHat aria-hidden strokeWidth={iconStroke} />
            {SHOPPING_LIST.addRecipe}
          </Button>
        )}
      </div>

      {props.status === "loading" && (
        <Skeleton variant="rows" count={4} label={SHOPPING_LIST.loadingLabel} />
      )}

      {props.status === "error" && (
        <ErrorState
          title={GENERIC_ERROR}
          retryLabel={RETRY_LABEL}
          onRetry={props.onRetry}
          className={RECIPE_STATE_CLASSES}
        />
      )}

      {props.status === "ready" && !isOnline && (
        <Banner title={OFFLINE_BANNER.title} icon={WifiOff}>
          {SHOPPING_LIST.offlineBody}
        </Banner>
      )}

      {props.status === "ready" && (
        <AddItemForm disabled={!isOnline} isAdding={props.isAddingItem} onAdd={props.onAddItem} />
      )}

      {props.status === "ready" && props.items.length === 0 && (
        <EmptyState
          icon={ShoppingCart}
          title={SHOPPING_LIST_EMPTY.title}
          body={SHOPPING_LIST_EMPTY.body}
          className={RECIPE_STATE_CLASSES}
        />
      )}

      {props.status === "ready" && groups !== null && groups.toBuy.length > 0 && (
        <GroupedList title={SHOPPING_LIST.toBuy}>
          {groups.toBuy.map((item) => (
            <ShoppingItemRow
              key={item.id}
              item={item}
              disabled={!isOnline}
              onToggle={(checked) => {
                props.onToggle(item, checked);
              }}
              onRemove={() => {
                props.onRemove(item);
              }}
            />
          ))}
        </GroupedList>
      )}

      {props.status === "ready" && groups !== null && groups.ticked.length > 0 && (
        <div className="flex flex-col gap-3">
          <GroupedList title={SHOPPING_LIST.ticked}>
            {groups.ticked.map((item) => (
              <ShoppingItemRow
                key={item.id}
                item={item}
                disabled={!isOnline}
                onToggle={(checked) => {
                  props.onToggle(item, checked);
                }}
                onRemove={() => {
                  props.onRemove(item);
                }}
              />
            ))}
          </GroupedList>
          <Button
            type="button"
            variant="ghost"
            tone="danger"
            className="self-start"
            loading={props.isClearing}
            disabled={!isOnline}
            onClick={props.onClearTicked}
          >
            {SHOPPING_LIST.clearTicked}
          </Button>
        </div>
      )}
    </div>
  );
}
