import { ADD_INGREDIENT, LOG_SEARCH, SEARCH_GROUP_HEADINGS } from "@keylow/core/copy";
import { vars } from "nativewind";
import { useCallback, useState } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { IngredientSearchResults } from "./IngredientSearchResults";
import { LogPlateButton } from "./LogPlateButton";
import { LogPlateStrip } from "./LogPlateStrip";
import { LogSearchResults } from "./LogSearchResults";
import { OwnFoodResults } from "./OwnFoodResults";
import { PlateSheet, PlateSheetChip } from "./PlateSheet";
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
 * In log mode the bars under the header show the day with the plate, every plus puts food on the plate, the
 * plate chip in the header opens Your plate to edit it, and Log food(s) beside the field writes it.
 */
export function FoodSearch(props: FoodSearchProps) {
  const { onClose, onOpenFood, onScanBarcode } = props;
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const scope = props.scope ?? "all";
  const isIngredient = props.ingredient !== undefined;
  const logging = props.logging;
  const { title, autoFocus } = WORDING[scope];
  const [isPlateOpen, setIsPlateOpen] = useState(false);
  const clearQuery = useCallback(() => {
    setQuery("");
  }, []);
  const openPlate = useCallback(() => {
    setIsPlateOpen(true);
  }, []);
  const closePlate = useCallback(() => {
    setIsPlateOpen(false);
  }, []);

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
        // The plate chip is wider than a control, so both ends are as wide as it and the title stays in the middle.
        hasWideSlots={logging !== undefined}
        trailingSlot={logging === undefined ? undefined : <PlateSheetChip onPress={openPlate} />}
      />
      {logging === undefined ? null : <LogPlateStrip day={logging.context.day} />}
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
              onPlateAdded={clearQuery}
            />
          )}
        </ScrollView>
      )}
      <SearchField
        autoFocus={autoFocus}
        dockAction={
          logging === undefined ? undefined : <LogPlateButton context={logging.context} />
        }
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
      {logging === undefined ? null : (
        <PlateSheet context={logging.context} open={isPlateOpen} onClose={closePlate} />
      )}
    </View>
  );
}
