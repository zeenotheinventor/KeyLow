import "../global.css";

import { KeyLowProvider } from "@keylow/api-client";
import { wrap } from "@sentry/react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthGate } from "../components/AuthGate";
import { PersistedDiaryCache } from "../components/PersistedDiaryCache";
import { RootErrorScreen } from "../components/RootErrorScreen";
import { RootNavigator } from "../components/RootNavigator";
import { ToastProvider } from "../components/ui";
import { startBodyFigureRead } from "../lib/bodyFigure";
import { startBodyMapRendererRead } from "../lib/bodyMapRenderer";
import { feedFocusManager, feedOnlineManager } from "../lib/connectivity";
import { createQueryClient } from "../lib/diaryCache";
import { setUpReminderNotifications } from "../lib/notifications";
import { initSentry } from "../lib/sentry/init";
import { readStoredUserId, supabase } from "../lib/supabase";
import { ThemeProvider } from "../lib/theme";
import { holdSplashScreen } from "../lib/updates";

// Starts error reporting as the module loads, so an error while the app starts is reported too. It does
// nothing in development or without a DSN.
initSentry();

// Runs as the module loads, before the splash screen could be hidden. `useHideSplashAfterUpdateCheck` lets
// it go.
holdSplashScreen();

// React Native has no online and offline events, so the queries are told whether the server can be reached.
feedOnlineManager();

// React Native has no window focus event either, so the queries are told when the app is back in the
// foreground, and a stale one refetches. Reads that the terms gate keeps off stay off.
feedFocusManager();

// Creates the reminders' Android channel and lets a reminder show while the app is open. A build without the
// notifications module does nothing, and a failure leaves the app as it was.
setUpReminderNotifications().catch(() => undefined);

// Starts reading the figure setting, so the screens that draw a body find it read and never draw the wrong
// figure first. A failure to read leaves Male.
startBodyFigureRead();

// Starts reading the body map's renderer setting too, so a person who chose 3D finds it read when the body map
// first opens, and never sees the 2D map first and then a jump to 3D. A failure to read leaves 2D.
startBodyMapRendererRead();

const queryClient = createQueryClient();

// Shown in place of the whole layout when a route fails to render, so a failure is a screen with a way out
// and a line in the device log, never a blank one. It brings its own theme and safe area.
export { RootErrorScreen as ErrorBoundary };

// The gesture root is the outermost view, so a drag works anywhere below it. The safe area comes next, for the
// screens and the toast. The toast provider sits inside the theme (the toast reads it) and the cache,
// and around the navigator, so a screen of any route can show one. The stored diary cache is read inside
// the query provider and around the sign-in gate, so the gate's own read finds the stored acceptance.
// Sentry wraps the whole layout, so a failure in it is reported.
function RootLayout() {
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

export default wrap(RootLayout);
