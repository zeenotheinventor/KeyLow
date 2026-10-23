import { WEIGHT_EMPTY } from "@keylow/core/copy";
import { View } from "react-native";

import { EmptyState } from "../../ui";

/**
 * The `empty` board: the scale in its tile, the title and the sentence. The board lifts it 48 points above
 * the middle of the space. Its two buttons, Add weigh-in and Connect Health Connect, are added by the
 * screens they open.
 */
export function WeightEmptyState() {
  return (
    <View className="flex-1 pb-12">
      <EmptyState body={WEIGHT_EMPTY.body} icon="Weight" title={WEIGHT_EMPTY.title} />
    </View>
  );
}
