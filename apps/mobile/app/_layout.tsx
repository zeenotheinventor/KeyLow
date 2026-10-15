import "../global.css";

import { KeyLowProvider } from "@keylow/api-client";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthGate } from "../components/AuthGate";
import { RootNavigator } from "../components/RootNavigator";
import { ToastProvider } from "../components/ui";
import { feedOnlineManager } from "../lib/connectivity";
import { supabase } from "../lib/supabase";
import { ThemeProvider } from "../lib/theme";
import { holdSplashScreen } from "../lib/updates";

// Runs as the module loads, before the splash screen could be hidden. `useHideSplashAfterUpdateCheck` lets
// it go.
holdSplashScreen();

// React Native has no online and offline events, so the queries are told whether the server can be reached.
feedOnlineManager();

// The gesture root is the outermost view, so a drag works anywhere below it. The safe area comes next, for the
// screens and the toast. The toast provider sits inside the theme (the toast reads it) and the cache,
// and around the navigator, so a screen of any route can show one.
export default function RootLayout() {
  return (
    <GestureHandlerRootView className="flex-1">
      <SafeAreaProvider>
        <ThemeProvider>
          <KeyLowProvider client={supabase}>
            <AuthGate>
              <ToastProvider>
                <RootNavigator />
              </ToastProvider>
            </AuthGate>
          </KeyLowProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
