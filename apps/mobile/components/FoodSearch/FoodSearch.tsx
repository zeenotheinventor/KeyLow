import { SEARCH_GROUP_HEADINGS } from "@keylow/core/copy";
import { vars } from "nativewind";
import { useState } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { OwnFoodResults } from "./OwnFoodResults";
import { SearchResults } from "./SearchResults";
import { IconButton, SearchField, SheetHeader } from "../ui";

import type { FoodSearchProps } from "./types";

const WORDING = {
  all: { title: "Find food", autoFocus: true },
  own: { title: SEARCH_GROUP_HEADINGS.yours.title, autoFocus: false },
} as const;

/**
 * The full-screen food search sheet: a header with close and create, the results scrolling above a
 * search field docked at the bottom, and the field's scan control. For `scope="own"` it is titled
 * "Your foods" and lists the user's own foods, and the cursor stays out of the field because the list
 * is what the user came for.
 */
export function FoodSearch({
  scope = "all",
  onClose,
  onCreateFood,
  onScanBarcode,
  onOpenFood,
}: FoodSearchProps) {
  const { title, autoFocus } = WORDING[scope];
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");

  return (
    // The insets are runtime values no class can name, so they go through variables, as the field's lift does.
    <View
      className="flex-1 bg-background pb-[var(--inset-bottom)] pt-[var(--inset-top)]"
      style={vars({ "--inset-top": insets.top, "--inset-bottom": insets.bottom })}
    >
      <SheetHeader
        leading={{ icon: "X", label: "Close", onPress: onClose }}
        title={title}
        trailing={{ icon: "Plus", label: "Create a food", onPress: onCreateFood }}
      />
      {scope === "own" ? (
        // The list scrolls itself, so it can load the next page when the end is reached.
        <OwnFoodResults query={query} onCreateFood={onCreateFood} onOpenFood={onOpenFood} />
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerClassName="grow gap-4 px-4 pb-4 pt-1"
          keyboardShouldPersistTaps="handled"
        >
          <SearchResults query={query} onCreateFood={onCreateFood} onOpenFood={onOpenFood} />
        </ScrollView>
      )}
      <SearchField
        autoFocus={autoFocus}
        label="Search foods"
        placeholder="Search for a food"
        trailing={
          <IconButton
            icon="ScanBarcode"
            label="Scan barcode"
            size="sm"
            variant="ghost"
            onPress={onScanBarcode}
          />
        }
        value={query}
        onChangeText={setQuery}
      />
    </View>
  );
}
