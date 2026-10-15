import { createClient } from "@supabase/supabase-js";
import { AppState } from "react-native";

import { installCryptoShim } from "./installCryptoShim";
import { LargeSecureStore } from "./LargeSecureStore";
import { authStorageKey, createStoredUserIdReader } from "./storedSession";

import type { Database } from "@keylow/api-client";

function requireEnvironmentValue(name: string, value: unknown): string {
  if (typeof value !== "string" || value === "") {
    throw new Error(`${name} is not set. Copy apps/mobile/.env.example to .env.local.`);
  }

  return value;
}

// Metro inlines each EXPO_PUBLIC_ variable only where it is read by its full name.
const supabaseUrl = requireEnvironmentValue(
  "EXPO_PUBLIC_SUPABASE_URL",
  process.env.EXPO_PUBLIC_SUPABASE_URL,
);
const supabaseAnonKey = requireEnvironmentValue(
  "EXPO_PUBLIC_SUPABASE_ANON_KEY",
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
);

// PKCE needs a secure random verifier, so the shim goes in before the client exists.
installCryptoShim();

const authStorage = new LargeSecureStore();
const storageKey = authStorageKey(supabaseUrl);

/** Whose session is stored on the phone, or null. It answers at once, whatever the connection. */
export const readStoredUserId = createStoredUserIdReader(authStorage, storageKey);

/** Removes the stored session, for a sign out that Supabase could not carry out (see `endSession`). */
export const removeStoredSession = () => authStorage.removeItem(storageKey);

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: authStorage,
    storageKey,
    flowType: "pkce",
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Tokens only refresh while the app is in the foreground, so the timer follows the app state.
AppState.addEventListener("change", (state) => {
  if (state === "active") {
    void supabase.auth.startAutoRefresh();
  } else {
    void supabase.auth.stopAutoRefresh();
  }
});
