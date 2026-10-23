import { ADD_INGREDIENT, LOG_SEARCH, SEARCH_GROUP_HEADINGS } from "@keylow/core/copy";
import { vars } from "nativewind";
import { useState } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { IngredientSearchResults } from "./IngredientSearchResults";
import { LogSearchResults } from "./LogSearchResults";
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
 * is what the user came for. With an `ingredient` it is titled "Add ingredient" and finds a food for a
 * recipe: no create control, and every row opens the amount step. The scan control is the same in every mode.
 */
export function FoodSearch(props: FoodSearchProps) {
  const { onClose, onOpenFood, onScanBarcode } = props;
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const scope = props.scope ?? "all";
  const isIngredient = props.ingredient !== undefined;
  const logging = props.logging;
  const { title, autoFocus } = WORDING[scope];

  return (
    // The insets are runtime values no class can name, so they go through variables, as the field's lift does.
    <View
      className="flex-1 bg-background pb-[var(--inset-bottom)] pt-[var(--inset-top)]"
      style={vars({ "--inset-top": insets.top, "--inset-bottom": insets.bottom })}
    >
      <SheetHeader
        leading={{ icon: "X", label: "Close", onPress: onClose }}
        title={
          isIngredient ? ADD_INGREDIENT.title : logging === undefined ? title : LOG_SEARCH.title
        }
        // Logging has no create control in the header, as its boards draw none. An empty search still offers one.
        // Nor has an ingredient search, because the form would take the person away from the recipe.
        trailing={
          props.ingredient !== undefined || logging !== undefined
            ? undefined
            : { icon: "Plus", label: "Create a food", onPress: props.onCreateFood }
        }
      />
      {props.ingredient !== undefined ? (
        <ScrollView
          className="flex-1"
          contentContainerClassName="grow gap-4 px-4 pb-4 pt-1"
          keyboardShouldPersistTaps="handled"
        >
          <IngredientSearchResults
            query={query}
            onOpenFood={onOpenFood}
            onOpenRecent={props.ingredient.onOpenRecent}
          />
        </ScrollView>
      ) : scope === "own" ? (
        // The list scrolls itself, so it can load the next page when the end is reached.
        <OwnFoodResults query={query} onCreateFood={props.onCreateFood} onOpenFood={onOpenFood} />
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerClassName="grow gap-4 px-4 pb-4 pt-1"
          keyboardShouldPersistTaps="handled"
        >
          {logging === undefined ? (
            <SearchResults
              query={query}
              onCreateFood={props.onCreateFood}
              onOpenFood={onOpenFood}
            />
          ) : (
            <LogSearchResults
              logging={logging}
              query={query}
              onCreateFood={props.onCreateFood}
              onOpenFood={onOpenFood}
            />
          )}
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
