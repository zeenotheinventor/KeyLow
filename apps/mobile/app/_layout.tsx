import "../global.css";

import { KeyLowProvider } from "@keylow/api-client";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { AuthGate } from "../components/AuthGate";
import { supabase } from "../lib/supabase";
import { ThemeProvider } from "../lib/theme";

export default function RootLayout() {
  return (
    <ThemeProvider>
      <KeyLowProvider client={supabase}>
        <AuthGate>
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false }} />
        </AuthGate>
      </KeyLowProvider>
    </ThemeProvider>
  );
}
