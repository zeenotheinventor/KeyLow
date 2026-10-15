import { useTargets } from "@keylow/api-client";
import { MORE_SCREEN, TAB_TITLES } from "@keylow/core/copy";
import { formatCalories } from "@keylow/core/format";
import { useRouter } from "expo-router";
import { ScrollView, View } from "react-native";

import { AppearanceSetting } from "../../components/AppearanceSetting";
import { ScreenHeader } from "../../components/ScreenHeader";
import { GroupedList, ListRow } from "../../components/ui";
import { supabase } from "../../lib/supabase";
import { useReadsEnabled } from "../../lib/useReadsEnabled";

// The sections of the `tab-shell.more` board, with Nutrition between Food and Body. Your foods opens the search
// sheet in its own-foods mode, Targets opens the Targets screen and shows the calorie target once one is set,
// Weight waits for its screen, Appearance is set here, and Sign out is Account's one row. About is under
// Settings and opens the About screen. No board draws it.
export default function MoreRoute() {
  const router = useRouter();
  const targets = useTargets({ enabled: useReadsEnabled() });
  const kcalTarget = targets.data?.kcal ?? null;

  return (
    <View className="flex-1">
      <ScreenHeader title={TAB_TITLES.more} />
      <ScrollView className="flex-1" contentContainerClassName="gap-4 px-4 pb-4 pt-1">
        <GroupedList title={MORE_SCREEN.food.title}>
          <ListRow
            icon="Apple"
            subtitle={MORE_SCREEN.food.yourFoods.subtitle}
            title={MORE_SCREEN.food.yourFoods.title}
            onPress={() => {
              router.push("/foods?scope=own");
            }}
          />
        </GroupedList>
        <GroupedList title={MORE_SCREEN.nutrition.title}>
          <ListRow
            icon="Target"
            subtitle={MORE_SCREEN.nutrition.targets.subtitle}
            title={MORE_SCREEN.nutrition.targets.title}
            unit={kcalTarget === null ? undefined : "kcal"}
            value={kcalTarget === null ? undefined : formatCalories(kcalTarget)}
            onPress={() => {
              router.push("/targets");
            }}
          />
        </GroupedList>
        <GroupedList title={MORE_SCREEN.body.title}>
          <ListRow
            disabled
            icon="Scale"
            subtitle={MORE_SCREEN.body.weight.subtitle}
            title={MORE_SCREEN.body.weight.title}
          />
        </GroupedList>
        <GroupedList title={MORE_SCREEN.settings.title}>
          <AppearanceSetting />
          <ListRow
            icon="Info"
            title={MORE_SCREEN.settings.about.title}
            onPress={() => {
              router.push("/about");
            }}
          />
        </GroupedList>
        <GroupedList title={MORE_SCREEN.account.title}>
          <ListRow
            chevron={false}
            icon="LogOut"
            title={MORE_SCREEN.account.signOut}
            onPress={() => {
              void supabase.auth.signOut();
            }}
          />
        </GroupedList>
      </ScrollView>
    </View>
  );
}
