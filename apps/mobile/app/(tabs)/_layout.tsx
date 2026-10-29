import { TAB_TITLES, TRAIN_HOME } from "@keylow/core/copy";
import { Tabs } from "expo-router/js-tabs";

import { MainTabBar } from "../../components/MainTabBar";
import { useTabTransitionOptions } from "../../components/ui";
import { useTheme } from "../../lib/theme";

// The tab bar draws four destinations, which are the screens named here. The centre plus is not a screen:
// the bar opens the search sheet for it, so it never becomes the open tab. What More holds, Your foods,
// Appearance and Sign out, has no screen of its own. A back press returns through the tabs the user came from.
// Train sits between Diary and More. It stayed out of the bar until the loop it opens could log and save a whole
// session, which it now can. Recipes was a destination too, and is now a row of More's Nutrition section.
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
      <Tabs.Screen name="train" options={{ title: TRAIN_HOME.tabLabel }} />
      <Tabs.Screen name="more" options={{ title: TAB_TITLES.more }} />
    </Tabs>
  );
}
