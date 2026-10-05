import { colors } from "@keylow/tokens";
import { Tabs } from "expo-router";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand["600"],
        tabBarIcon: () => null,
      }}
    >
      <Tabs.Screen name="diary" options={{ title: "Diary" }} />
      <Tabs.Screen name="recipes" options={{ title: "Recipes" }} />
      <Tabs.Screen name="weight" options={{ title: "Weight" }} />
      <Tabs.Screen name="settings" options={{ title: "Settings" }} />
    </Tabs>
  );
}
