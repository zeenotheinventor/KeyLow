import "../global.css";

import { KeyLowProvider } from "@keylow/api-client";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { AuthGate } from "../components/AuthGate";
import { supabase } from "../lib/supabase";

export default function RootLayout() {
  return (
    <KeyLowProvider client={supabase}>
      <AuthGate>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }} />
      </AuthGate>
    </KeyLowProvider>
  );
}
