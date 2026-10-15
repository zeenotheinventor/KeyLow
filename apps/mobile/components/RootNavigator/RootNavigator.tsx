import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";

import { useTheme } from "../../lib/theme";
import { useHideSplashAfterUpdateCheck } from "../../lib/updates";

/**
 * What the root layout shows once the session is known and the theme applied: the screens in the theme's
 * colours, on the `background` token, with a status bar whose content is light on the dark theme and dark
 * on the light one. It also lets the splash screen go once the check for a newer update has settled, so
 * the screens are ready behind it by then.
 */
export function RootNavigator() {
  const { scheme, colors } = useTheme();
  useHideSplashAfterUpdateCheck();

  return (
    <View className="flex-1 bg-background">
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <Stack
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}
      >
        {/* The food search sheet covers the tabs and slides up from the bottom. */}
        <Stack.Screen
          name="foods"
          options={{ presentation: "fullScreenModal", animation: "slide_from_bottom" }}
        />
      </Stack>
    </View>
  );
}
