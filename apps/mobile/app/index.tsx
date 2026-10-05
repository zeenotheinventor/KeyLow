import { colors } from "@keylow/tokens";
import { Text, View } from "react-native";

export default function IndexRoute() {
  return (
    <View className="flex-1 items-center justify-center bg-brand-500">
      <Text accessibilityRole="header" className="text-4xl text-neutral-50">
        KeyLow
      </Text>
      <Text className="text-base text-neutral-50">{colors.brand["500"]}</Text>
    </View>
  );
}
