import { WEIGHT_EMPTY } from "@keylow/core/copy";
import { useRouter } from "expo-router";
import { View } from "react-native";

import { EmptyState } from "../../ui";

/**
 * The `empty` board: the scale in its tile, the title and the sentence. The board lifts it 48 points above
 * the middle of the space. Add weigh-in opens the sheet that adds one. Connect Health Connect is added by
 * the screen it opens.
 */
export function WeightEmptyState() {
  const router = useRouter();

  return (
    <View className="flex-1 pb-12">
      <EmptyState
        action={{
          label: WEIGHT_EMPTY.addWeighIn,
          variant: "primary",
          onPress: () => {
            router.push("/more/weight/entry");
          },
        }}
        body={WEIGHT_EMPTY.body}
        icon="Weight"
        title={WEIGHT_EMPTY.title}
      />
    </View>
  );
}
