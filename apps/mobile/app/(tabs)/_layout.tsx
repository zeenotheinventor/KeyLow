import { TAB_TITLES, TRAIN_HOME } from "@keylow/core/copy";
import { Tabs } from "expo-router/js-tabs";

import { MainTabBar } from "../../components/MainTabBar";
import { useTabTransitionOptions } from "../../components/ui";
import { useTheme } from "../../lib/theme";

// The tab bar draws four destinations, which are the screens named here. The centre plus is not a screen:
// the bar opens the search sheet for it, so it never becomes the open tab. What More holds, Your foods,
// Appearance and Sign out, has no screen of its own. A back press returns through the tabs the user came from.
// Train is the fifth destination between Recipes and More, and it stays out of the bar (`href: null`) until the
// loop it opens can log a whole session. Removing the `href` is what shows it.
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
      <Tabs.Screen name="train" options={{ title: TRAIN_HOME.tabLabel, href: null }} />
      <Tabs.Screen name="more" options={{ title: TAB_TITLES.more }} />
    </Tabs>
  );
}
