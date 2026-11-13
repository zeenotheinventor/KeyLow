import { PALATE_WORDS, YOUR_FOOD } from "@keylow/core/copy";
import { useRouter } from "expo-router";
import { vars } from "nativewind";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SheetHeader, Text } from "../ui";

/**
 * "What you usually eat", pushed from the Your food group of the Assistant settings. For now it is a stack
 * header and "Coming soon", so the group's row does not lead nowhere. The palate screen replaces the body.
 */
export function PalateScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  function goBack() {
    // A cold link to this screen has nothing before it, so Back goes to the Assistant settings instead.
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/more/assistant");
    }
  }

  return (
    // The insets are runtime values no class can name, so they go through variables, as the About screen's do.
    <View
      className="flex-1 bg-background pb-[var(--inset-bottom)] pt-[var(--inset-top)]"
      style={vars({ "--inset-top": insets.top, "--inset-bottom": insets.bottom })}
    >
      <SheetHeader
        leading={{ icon: "ChevronLeft", label: PALATE_WORDS.back, onPress: goBack }}
        title={PALATE_WORDS.title}
      />
      <View className="px-4 pt-1">
        <Text tone="secondary">{YOUR_FOOD.comingSoon}</Text>
      </View>
    </View>
  );
}
