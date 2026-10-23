import { UPDATING_LABEL } from "@keylow/core/copy";
import { StatusBar } from "expo-status-bar";
import { Image, View } from "react-native";

import logo from "../../assets/splash-icon.png";
import { ThemeProvider } from "../../lib/theme";
import { ProgressBar } from "../ui";

import type { UpdateScreenProps } from "./types";

// The status bar's content is light on the dark background, whatever the app's theme is.
const statusBarStyle = "light";

/**
 * What the app shows while an update downloads: the logo as the native splash screen draws it, centred
 * and 200 points wide, with a 200 point progress bar 24 points under it, and no words. The splash screen
 * is the dark background in every theme, so the screen brings the dark theme with it and does not follow
 * the app's. The logo sits where the splash screen's does, because the bar hangs below its box and does
 * not take part in centring it. Like the root error screen it fills what it is given, so the caller puts it
 * over the app.
 */
export function UpdateScreen({ progress, onLayout }: UpdateScreenProps) {
  return (
    <ThemeProvider fixedPreference="dark">
      <View
        className="flex-1 items-center justify-center bg-background"
        testID="update-screen"
        onLayout={onLayout}
      >
        <StatusBar style={statusBarStyle} />
        <View className="aspect-square w-[200px]">
          <Image aria-hidden className="h-full w-full object-contain" source={logo} />
          <View className="absolute inset-x-0 top-full mt-6">
            <ProgressBar label={UPDATING_LABEL} value={progress ? progress * 100 : undefined} />
          </View>
        </View>
      </View>
    </ThemeProvider>
  );
}
