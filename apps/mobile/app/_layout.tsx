import "../global.css";

import { KeyLowProvider } from "@keylow/api-client";

import { AuthGate } from "../components/AuthGate";
import { RootNavigator } from "../components/RootNavigator";
import { supabase } from "../lib/supabase";
import { ThemeProvider } from "../lib/theme";
import { holdSplashScreen } from "../lib/updates";

// Runs as the module loads, before the splash screen could be hidden. `useHideSplashAfterUpdateCheck` lets
// it go.
holdSplashScreen();

export default function RootLayout() {
  return (
    <ThemeProvider>
      <KeyLowProvider client={supabase}>
        <AuthGate>
          <RootNavigator />
        </AuthGate>
      </KeyLowProvider>
    </ThemeProvider>
  );
}
