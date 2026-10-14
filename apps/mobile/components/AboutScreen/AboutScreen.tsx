import { ABOUT_SCREEN } from "@keylow/core/copy";
import { useRouter } from "expo-router";
import { vars } from "nativewind";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SheetHeader, Text } from "../ui";
import { DataSourceCredit } from "./DataSourceCredit";

/**
 * The About screen, pushed from More: a stack header with Back, and the Data sources section, which
 * credits the datasets the app shows foods from, as their licences ask. No board draws it, so it is built
 * from the kit's header, text and card.
 */
export function AboutScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { dataSources } = ABOUT_SCREEN;

  function goBack() {
    // A cold link to this screen has nothing before it, so Back goes to More instead.
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)/more");
    }
  }

  return (
    // The insets are runtime values no class can name, so they go through variables, as the food screens' do.
    <View
      className="flex-1 bg-background pb-[var(--inset-bottom)] pt-[var(--inset-top)]"
      style={vars({ "--inset-top": insets.top, "--inset-bottom": insets.bottom })}
    >
      <SheetHeader
        leading={{ icon: "ChevronLeft", label: ABOUT_SCREEN.back, onPress: goBack }}
        title={ABOUT_SCREEN.title}
        variant="stack"
      />
      <ScrollView className="flex-1" contentContainerClassName="gap-2 px-4 pb-4 pt-1">
        {/* A section title is 32 points high at least, as the grouped lists draw it. */}
        <View className="min-h-[32px] justify-center px-1">
          <Text role="heading" variant="body-strong">
            {dataSources.title}
          </Text>
        </View>
        <DataSourceCredit
          name={dataSources.cofid.name}
          text={dataSources.cofid.text}
          url={dataSources.cofid.url}
        />
        <DataSourceCredit
          name={dataSources.off.name}
          text={dataSources.off.text}
          url={dataSources.off.url}
        />
      </ScrollView>
    </View>
  );
}
