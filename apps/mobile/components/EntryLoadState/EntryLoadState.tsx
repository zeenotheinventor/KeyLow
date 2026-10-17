import { ENTRY_NOT_FOUND, FOOD_FORM, GENERIC_ERROR, RETRY_LABEL } from "@keylow/core/copy";
import { vars } from "nativewind";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { EmptyState, ErrorState, SheetHeader, Skeleton } from "../ui";

import type { EntryLoadStateProps } from "./types";

/**
 * What the quick add form and the entry screen show while what they need is loading, failed to load, or is
 * not there: their header with Back, and the kit's skeleton, failure or empty state under it, as the Targets
 * screen does. The failure itself is never shown, only its fixed sentence.
 */
export function EntryLoadState({ state, title, onBack, onRetry }: EntryLoadStateProps) {
  const insets = useSafeAreaInsets();

  function renderBody() {
    if (state === "error") {
      return (
        <View className="flex-1 pb-[160px]">
          <ErrorState retry={{ label: RETRY_LABEL, onPress: onRetry }} title={GENERIC_ERROR} />
        </View>
      );
    }
    if (state === "notFound") {
      return (
        <View className="flex-1 pb-[160px]">
          <EmptyState body={ENTRY_NOT_FOUND.body} icon="SearchX" title={ENTRY_NOT_FOUND.title} />
        </View>
      );
    }

    return (
      <View accessible aria-label={title} aria-live="polite" className="px-4 py-1" role="status">
        <Skeleton rows={2} variant="entryGroup" />
      </View>
    );
  }

  return (
    // The top inset is a runtime value no class can name, so it goes through a variable, as the Targets screen's does.
    <View
      className="flex-1 bg-background pt-[var(--inset-top)]"
      style={vars({ "--inset-top": insets.top })}
    >
      <SheetHeader
        leading={{ icon: "ChevronLeft", label: FOOD_FORM.back, onPress: onBack }}
        title={title}
      />
      {renderBody()}
    </View>
  );
}
