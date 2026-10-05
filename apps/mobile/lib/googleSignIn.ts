import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { Platform } from "react-native";

import { supabase } from "./supabase";

export type GoogleSignInResult =
  { status: "signed-in" } | { status: "cancelled" } | { status: "error"; message: string };

const notConfiguredMessage = "Google sign-in is not configured yet";
const failedMessage = "Google sign-in failed. Try again.";
const missingIdTokenMessage = "Google did not return an ID token. Try again.";

function isFilled(value: unknown): value is string {
  return typeof value === "string" && value !== "";
}

export async function signInWithGoogle(): Promise<GoogleSignInResult> {
  // Metro inlines each EXPO_PUBLIC_ variable only where it is read by its full name.
  const iosClientId: unknown = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  const webClientId: unknown = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  if (!isFilled(iosClientId) || !isFilled(webClientId)) {
    return { status: "error", message: notConfiguredMessage };
  }

  try {
    GoogleSignin.configure({ iosClientId, webClientId });
    if (Platform.OS === "android") {
      await GoogleSignin.hasPlayServices();
    }

    const response = await GoogleSignin.signIn();
    if (response.type === "cancelled") {
      return { status: "cancelled" };
    }

    const idToken = response.data.idToken;
    if (idToken === null) {
      return { status: "error", message: missingIdTokenMessage };
    }

    const { error } = await supabase.auth.signInWithIdToken({ provider: "google", token: idToken });

    return error === null ? { status: "signed-in" } : { status: "error", message: error.message };
  } catch (error) {
    if (__DEV__) {
      console.warn("Google sign-in failed", error);
    }

    return { status: "error", message: failedMessage };
  }
}
