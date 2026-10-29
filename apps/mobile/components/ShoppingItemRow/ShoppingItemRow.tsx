import { describeRemoveItem, describeShoppingItemCaption } from "@keylow/core/copy";
import { View } from "react-native";

import { Checkbox, IconButton, Text } from "../ui";

import type { ShoppingItemRowProps } from "./types";

/**
 * One item of the shopping list, inside a `GroupedList`: a box named by the item, the amount and the
 * recipes it came from under it, and an X that removes it. A ticked item is struck through and muted.
 */
export function ShoppingItemRow({ item, disabled, onToggle, onRemove }: ShoppingItemRowProps) {
  const caption = describeShoppingItemCaption(item);
  const isTicked = item.checked_at !== null;

  return (
    <View className="min-h-[56px] flex-row items-center gap-2 py-1 pl-4 pr-2">
      <View className="min-w-0 flex-1 pt-2">
        <Checkbox
          accessibilityLabel={item.name}
          checked={isTicked}
          disabled={disabled}
          label={
            isTicked ? (
              <Text className="line-through" tone="muted">
                {item.name}
              </Text>
            ) : (
              item.name
            )
          }
          onChange={onToggle}
        />
        {caption === null ? null : (
          <Text className="-mt-2 pb-2 pl-[34px]" tone="muted" variant="caption">
            {caption}
          </Text>
        )}
      </View>
      <IconButton
        disabled={disabled}
        icon="X"
        label={describeRemoveItem(item.name)}
        size="sm"
        tone="secondary"
        variant="ghost"
        onPress={onRemove}
      />
    </View>
  );
}
