import { useRouter } from "expo-router";
import { Pressable, Text } from "react-native";

import { PlaceholderScreen } from "../../components/PlaceholderScreen";

export default function DiaryRoute() {
  const router = useRouter();

  return (
    <PlaceholderScreen title="Diary">
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          router.push("/foods");
        }}
        className="h-12 items-center justify-center rounded-lg bg-legacy-brand-600 px-6"
      >
        <Text className="text-base font-semibold text-legacy-neutral-50">Find food</Text>
      </Pressable>
    </PlaceholderScreen>
  );
}
