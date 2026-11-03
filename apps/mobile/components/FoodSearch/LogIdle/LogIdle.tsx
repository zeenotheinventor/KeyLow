import { ASSISTANT_DESCRIBE, DIARY_ACTIONS } from "@keylow/core/copy";
import { View } from "react-native";

import { Card, ListRow } from "../../ui";
import { FavouriteFoods } from "../FavouriteFoods";
import { RecentFoods } from "../RecentFoods";

import type { LogIdleProps } from "./types";

/**
 * What the log search shows before anything is typed, as the log search boards draw it: the Quick add row
 * and under it the Describe row (`assistant · describe`), then the Favourites strip, then Recent. Quick add stays pressable offline, because the form it opens waits
 * for a connection itself.
 */
export function LogIdle({
  onOpenFavouriteFood,
  onOpenFavouriteRecipe,
  onQuickAdd,
  onDescribe,
  ...recent
}: LogIdleProps) {
  return (
    <View className="gap-4">
      <Card padding={0}>
        <ListRow
          icon="Zap"
          subtitle={DIARY_ACTIONS.quickAddCaption}
          title={DIARY_ACTIONS.quickAdd}
          onPress={onQuickAdd}
        />
        <ListRow
          icon="MessageSquareText"
          subtitle={ASSISTANT_DESCRIBE.rowCaption}
          title={ASSISTANT_DESCRIBE.rowTitle}
          onPress={onDescribe}
        />
      </Card>
      <FavouriteFoods onOpenFood={onOpenFavouriteFood} onOpenRecipe={onOpenFavouriteRecipe} />
      <RecentFoods {...recent} />
    </View>
  );
}
