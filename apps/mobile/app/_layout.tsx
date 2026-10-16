import "../global.css";

import { KeyLowProvider } from "@keylow/api-client";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthGate } from "../components/AuthGate";
import { PersistedDiaryCache } from "../components/PersistedDiaryCache";
import { RootErrorScreen } from "../components/RootErrorScreen";
import { RootNavigator } from "../components/RootNavigator";
import { ToastProvider } from "../components/ui";
import { feedOnlineManager } from "../lib/connectivity";
import { createQueryClient } from "../lib/diaryCache";
import { readStoredUserId, supabase } from "../lib/supabase";
import { ThemeProvider } from "../lib/theme";
import { holdSplashScreen } from "../lib/updates";

// Runs as the module loads, before the splash screen could be hidden. `useHideSplashAfterUpdateCheck` lets
// it go.
holdSplashScreen();

// React Native has no online and offline events, so the queries are told whether the server can be reached.
feedOnlineManager();

const queryClient = createQueryClient();

// Shown in place of the whole layout when a route fails to render, so a failure is a screen with a way out
// and a line in the device log, never a blank one. It brings its own theme and safe area.
export { RootErrorScreen as ErrorBoundary };

// The gesture root is the outermost view, so a drag works anywhere below it. The safe area comes next, for the
// screens and the toast. The toast provider sits inside the theme (the toast reads it) and the cache,
// and around the navigator, so a screen of any route can show one. The stored diary cache is read inside
// the query provider and around the sign-in gate, so the gate's own read finds the stored acceptance.
export default function RootLayout() {
  return (
    <GestureHandlerRootView className="flex-1">
      <SafeAreaProvider>
        <ThemeProvider>
          <KeyLowProvider client={supabase} queryClient={queryClient}>
            <PersistedDiaryCache readStoredUserId={readStoredUserId}>
              <AuthGate readStoredUserId={readStoredUserId}>
                <ToastProvider>
                  <RootNavigator />
                </ToastProvider>
              </AuthGate>
            </PersistedDiaryCache>
          </KeyLowProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
