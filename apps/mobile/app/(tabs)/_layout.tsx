import { TAB_TITLES } from "@keylow/core/copy";
import { Tabs } from "expo-router/js-tabs";

import { MainTabBar } from "../../components/MainTabBar";
import { useTabTransitionOptions } from "../../components/ui";
import { useTheme } from "../../lib/theme";

// The tab bar draws four destinations, which are the screens named here. The centre plus is not a screen:
// the bar opens the search sheet for it, so it never becomes the open tab. `weight` and `settings` are
// reached from More and have no place in the bar until More is built. A back press returns through the
// tabs the user came from.
export default function TabsLayout() {
  const { colors } = useTheme();
  const transition = useTabTransitionOptions();

  return (
    <Tabs
      backBehavior="history"
      screenOptions={{
        headerShown: false,
        // The scene sits behind a tab change, so it takes the screen's colour and a fade never shows white.
        sceneStyle: { backgroundColor: colors.background },
        ...transition,
      }}
      tabBar={(props) => <MainTabBar {...props} />}
    >
      <Tabs.Screen name="dashboard" options={{ title: TAB_TITLES.dashboard }} />
      <Tabs.Screen name="diary" options={{ title: TAB_TITLES.diary }} />
      <Tabs.Screen name="recipes" options={{ title: TAB_TITLES.recipes }} />
      <Tabs.Screen name="more" options={{ title: TAB_TITLES.more }} />
    </Tabs>
  );
}
