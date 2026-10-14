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
          <Stack screenOptions={{ headerShown: false }}>
            {/* The food search sheet covers the tabs and slides up from the bottom. */}
            <Stack.Screen
              name="foods"
              options={{ presentation: "fullScreenModal", animation: "slide_from_bottom" }}
            />
          </Stack>
        </AuthGate>
      </KeyLowProvider>
    </ThemeProvider>
  );
}
