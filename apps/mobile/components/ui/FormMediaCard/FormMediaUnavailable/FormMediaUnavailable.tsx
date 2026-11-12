import { EXERCISE_FORM } from "@keylow/core/copy";
import { View } from "react-native";

import { Card } from "../../Card";
import { Text } from "../../Text";

/** One quiet line for offline or a failed read. It is not an error, so it has no error styling. */
export function FormMediaUnavailable() {
  return (
    <Card padding={0} role="status">
      <View className="min-h-touch-target justify-center px-4 py-3">
        <Text tone="secondary">{EXERCISE_FORM.unavailable}</Text>
      </View>
    </Card>
  );
}
