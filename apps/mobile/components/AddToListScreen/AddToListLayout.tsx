import { FOOD_FORM, OFFLINE_BANNER, SHOPPING_LIST } from "@keylow/core/copy";
import { vars } from "nativewind";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useIsOnline } from "../../lib/connectivity";
import { Banner, Button, SheetHeader } from "../ui";

import type { AddToListLayoutProps } from "./types";

// The space under the Add button, and the least room under it for the system bar, as the recipe view keeps.
const CONTENT_BOTTOM_GAP = 16;
const MINIMUM_BOTTOM_PADDING = 34;

/**
 * The frame of an add to the shopping list: the header with its subtitle, the scrolling content, and Cancel and
 * Add at the foot. Add waits for a connection and for `canAdd`, and shows it is working while `isAdding`. The
 * offline banner is drawn here, so every add says the same thing.
 */
export function AddToListLayout({
  subtitle,
  canAdd,
  isAdding,
  onAdd,
  onLeave,
  children,
}: AddToListLayoutProps) {
  const isOnline = useIsOnline();
  const insets = useSafeAreaInsets();

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
        subtitle={subtitle}
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
        {children}
      </ScrollView>
      <View className="flex-row gap-2 px-4 pb-[var(--content-bottom)] pt-2">
        <View className="flex-1">
          <Button fullWidth variant="secondary" onPress={onLeave}>
            {SHOPPING_LIST.cancel}
          </Button>
        </View>
        <View className="flex-1">
          <Button
            disabled={!isOnline || !canAdd}
            fullWidth
            haptic="confirm"
            loading={isAdding}
            onPress={onAdd}
          >
            {SHOPPING_LIST.addItem}
          </Button>
        </View>
      </View>
    </View>
  );
}
