import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";

import { useTheme } from "../../lib/theme";
import { useHideSplashAfterUpdateCheck } from "../../lib/updates";
import { UpdateScreen } from "../UpdateScreen";

/**
 * What the root layout shows once the session is known and the theme applied: the screens in the theme's
 * colours, on the `background` token, with a status bar whose content is light on the dark theme and dark
 * on the light one. It also lets the splash screen go once the check for a newer update has settled, so
 * the screens are ready behind it by then. While an update downloads, the update screen covers the
 * screens, which are hidden from a screen reader, and the splash screen goes once that is laid out.
 */
export function RootNavigator() {
  const { scheme, colors } = useTheme();
  const { isUpdateScreenShown, progress, handleUpdateScreenLayout } =
    useHideSplashAfterUpdateCheck();

  return (
    <View className="flex-1 bg-background">
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      {/* Behind the update screen the screens are hidden from a screen reader, so it cannot focus what it covers. */}
      <View aria-hidden={isUpdateScreenShown} className="flex-1">
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          {/* The food search sheet covers the tabs and slides up from the bottom. */}
          <Stack.Screen
            name="foods"
            options={{ presentation: "fullScreenModal", animation: "slide_from_bottom" }}
          />
          {/* The active session covers the tabs and slides up, and hiding it slides it back down. */}
          <Stack.Screen
            name="session"
            options={{ presentation: "fullScreenModal", animation: "slide_from_bottom" }}
          />
        </Stack>
      </View>
      {isUpdateScreenShown ? (
        <View className="absolute inset-0">
          <UpdateScreen progress={progress} onLayout={handleUpdateScreenLayout} />
        </View>
      ) : null}
    </View>
  );
}
