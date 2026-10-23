import { WEIGHT_EMPTY } from "@keylow/core/copy";
import { useRouter } from "expo-router";
import { View } from "react-native";

import { EmptyState } from "../../ui";

import type { WeightEmptyStateProps } from "./types";

/**
 * The `empty` board: the scale in its tile, the title and the sentence. The board lifts it 48 points above
 * the middle of the space. Add weigh-in opens the sheet that adds one, and Connect Health Connect, drawn
 * under it while the screen offers the flow, opens the permission flow.
 */
export function WeightEmptyState({ onConnectHealth }: WeightEmptyStateProps) {
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
        secondaryAction={
          onConnectHealth === undefined
            ? undefined
            : { label: WEIGHT_EMPTY.connectHealth, icon: "Heart", onPress: onConnectHealth }
        }
        title={WEIGHT_EMPTY.title}
      />
    </View>
  );
}
