import { cssInterop } from "nativewind";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemeProvider } from "../../lib/theme";

import type { ThemedStoryProps } from "./types";

cssInterop(SafeAreaView, { className: "style" });

/**
 * Shows a story the way the app does: the ThemeProvider, the safe-area insets from the root provider above
 * Storybook, and the background token. The scheme is fixed, so the app's saved Appearance setting and the
 * native scheme, which the Storybook chrome follows, are left as they are.
 */
export function ThemedStory({ scheme, children }: ThemedStoryProps) {
  return (
    <ThemeProvider fixedPreference={scheme}>
      <SafeAreaView className="flex-1 bg-background">{children}</SafeAreaView>
    </ThemeProvider>
  );
}
