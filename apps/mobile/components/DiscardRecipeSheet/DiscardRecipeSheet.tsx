import { DISCARD_SHEET } from "@keylow/core/copy";
import { View } from "react-native";

import { BottomSheet, Button, Text } from "../ui";

import type { DiscardRecipeSheetProps } from "./types";

/**
 * Asked when the recipe editor is left with unsaved changes: the title and a line saying what is lost, then
 * Discard changes and Keep editing. Closing the sheet any other way (the dim, a drag down, the back button)
 * keeps the work, so only the destructive button throws it away.
 */
export function DiscardRecipeSheet({
  open,
  isNewRecipe,
  onKeepEditing,
  onDiscard,
}: DiscardRecipeSheetProps) {
  return (
    <BottomSheet
      isTitleCentred
      open={open}
      title={isNewRecipe ? DISCARD_SHEET.newTitle : DISCARD_SHEET.editTitle}
      onClose={onKeepEditing}
    >
      <Text className="text-center" tone="secondary">
        {isNewRecipe ? DISCARD_SHEET.newBody : DISCARD_SHEET.editBody}
      </Text>
      <View className="gap-2 pt-5">
        <Button fullWidth size="lg" variant="destructive" onPress={onDiscard}>
          {DISCARD_SHEET.discard}
        </Button>
        <Button fullWidth size="lg" variant="secondary" onPress={onKeepEditing}>
          {DISCARD_SHEET.keepEditing}
        </Button>
      </View>
    </BottomSheet>
  );
}
