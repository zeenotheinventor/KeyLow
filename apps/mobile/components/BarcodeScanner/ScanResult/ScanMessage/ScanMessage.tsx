import { View } from "react-native";

import { Text } from "../../../ui";

import type { ScanMessageProps } from "./types";

/** A heading and, if there is one, a sentence, left aligned in the flow of the result, for a code nothing has or a misread. */
export function ScanMessage({ title, body }: ScanMessageProps) {
  return (
    <View className="gap-2 px-1 pt-2">
      <Text role="heading" variant="h2">
        {title}
      </Text>
      {body === undefined ? null : <Text tone="secondary">{body}</Text>}
    </View>
  );
}
