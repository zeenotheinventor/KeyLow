import {
  FOOD_FORM,
  GENERIC_ERROR,
  OFFLINE_BANNER,
  RETRY_LABEL,
  SHOPPING_LIST,
  SHOPPING_LIST_EMPTY,
} from "@keylow/core/copy";
import { groupShoppingList } from "@keylow/core/shopping";
import { vars } from "nativewind";
import { useState } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ShoppingItemRow } from "../ShoppingItemRow";
import {
  Banner,
  Button,
  EmptyState,
  ErrorState,
  GroupedList,
  Input,
  SheetHeader,
  Skeleton,
} from "../ui";

import type { ShoppingListViewProps } from "./types";
import type { ShoppingItem } from "@keylow/core/shopping";

// How many skeleton rows the loading state draws, as the library does.
const LOADING_ROWS = 4;

// A state sits 80 points above the bottom of the space, as the recipe screens lift theirs.
const stateClassName = "flex-1 pb-20";

function AddItemRow({
  disabled,
  isAdding,
  onAdd,
}: {
  disabled: boolean;
  isAdding: boolean;
  onAdd: (text: string, onAdded: () => void) => void;
}) {
  const [text, setText] = useState("");

  function submit() {
    onAdd(text, () => {
      setText("");
    });
  }

  return (
    <View className="flex-row items-end gap-2">
      <View className="min-w-0 flex-1">
        <Input
          autoCapitalize="sentences"
          density="compact"
          disabled={disabled}
          label={SHOPPING_LIST.addItemPlaceholder}
          labelHidden
          placeholder={SHOPPING_LIST.addItemPlaceholder}
          returnKeyType="done"
          value={text}
          onChangeText={setText}
          onSubmitEditing={submit}
        />
      </View>
      <Button
        disabled={disabled}
        icon="Plus"
        loading={isAdding}
        variant="secondary"
        onPress={submit}
      >
        {SHOPPING_LIST.addItem}
      </Button>
    </View>
  );
}

/**
 * The shopping list, a full-height screen pushed over the recipes: Back and the title, Add a recipe, a
 * field to add an item by hand, then what is still to buy and what is ticked. Which items are to buy and
 * their order are core's (`groupShoppingList`). Ticked items stay at the bottom until Clear ticked items,
 * which the screen asks about first. The screen that reads and writes the list is `ShoppingListScreen`.
 */
export function ShoppingListView(props: ShoppingListViewProps) {
  const insets = useSafeAreaInsets();
  const isOnline = props.status !== "ready" || props.isOnline;

  function renderRows(items: readonly ShoppingItem[]) {
    if (props.status !== "ready") {
      return null;
    }
    const { onToggle, onRemove } = props;

    return items.map((item) => (
      <ShoppingItemRow
        key={item.id}
        disabled={!isOnline}
        item={item}
        onRemove={() => {
          onRemove(item);
        }}
        onToggle={(checked) => {
          onToggle(item, checked);
        }}
      />
    ));
  }

  function renderBody() {
    switch (props.status) {
      case "loading":
        return (
          <View accessible aria-label={SHOPPING_LIST.loadingLabel} aria-live="polite" role="status">
            <Skeleton rows={LOADING_ROWS} variant="group" />
          </View>
        );
      case "error":
        return (
          <View className={stateClassName}>
            <ErrorState
              retry={{ label: RETRY_LABEL, onPress: props.onRetry }}
              title={GENERIC_ERROR}
            />
          </View>
        );
      case "offline":
        return (
          <Banner body={SHOPPING_LIST.offlineBody} title={OFFLINE_BANNER.title} variant="offline" />
        );
      case "ready": {
        const groups = groupShoppingList(props.items);

        return (
          <>
            {isOnline ? null : (
              <Banner
                body={SHOPPING_LIST.offlineBody}
                title={OFFLINE_BANNER.title}
                variant="offline"
              />
            )}
            <Button
              disabled={!isOnline}
              fullWidth
              icon="ChefHat"
              variant="primary"
              onPress={props.onAddRecipe}
            >
              {SHOPPING_LIST.addRecipe}
            </Button>
            <AddItemRow
              disabled={!isOnline}
              isAdding={props.isAddingItem}
              onAdd={props.onAddItem}
            />
            {props.items.length === 0 ? (
              <View className={stateClassName}>
                <EmptyState
                  body={SHOPPING_LIST_EMPTY.body}
                  icon="ShoppingCart"
                  title={SHOPPING_LIST_EMPTY.title}
                />
              </View>
            ) : null}
            {groups.toBuy.length > 0 ? (
              <GroupedList title={SHOPPING_LIST.toBuy}>{renderRows(groups.toBuy)}</GroupedList>
            ) : null}
            {groups.ticked.length > 0 ? (
              <View className="gap-2">
                <GroupedList title={SHOPPING_LIST.ticked}>{renderRows(groups.ticked)}</GroupedList>
                <Button
                  className="self-start"
                  disabled={!isOnline}
                  size="sm"
                  tone="danger"
                  variant="ghost"
                  onPress={props.onClearTicked}
                >
                  {SHOPPING_LIST.clearTicked}
                </Button>
              </View>
            ) : null}
          </>
        );
      }
    }
  }

  return (
    // The top inset is a runtime value no class can name, so it goes through a variable, as the archived
    // recipes screen's does.
    <View
      className="flex-1 bg-background pt-[var(--inset-top)]"
      style={vars({ "--inset-top": insets.top })}
    >
      <SheetHeader
        leading={{ icon: "ChevronLeft", label: FOOD_FORM.back, onPress: props.onBack }}
        title={SHOPPING_LIST.title}
      />
      <ScrollView
        className="flex-1"
        contentContainerClassName="grow gap-3 px-4 pb-4 pt-1"
        keyboardShouldPersistTaps="handled"
      >
        {renderBody()}
      </ScrollView>
    </View>
  );
}
