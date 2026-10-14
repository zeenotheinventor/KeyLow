import "../global.css";

import { KeyLowProvider } from "@keylow/api-client";

import { AuthGate } from "../components/AuthGate";
import { RootNavigator } from "../components/RootNavigator";
import { supabase } from "../lib/supabase";
import { ThemeProvider } from "../lib/theme";

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
