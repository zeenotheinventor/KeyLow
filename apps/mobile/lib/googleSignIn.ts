import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { Platform } from "react-native";

import { authErrorCode } from "./authErrorCode";
import { supabase } from "./supabase";

/**
 * An error carries a code for `describeAuthError`, never a message. Only a failure Supabase answered has
 * one. A client id that is not set, a sheet that fails and a missing ID token have none, so they read as
 * the generic sentence.
 */
export type GoogleSignInResult =
  { status: "signed-in" } | { status: "cancelled" } | { status: "error"; code: string | undefined };

const failure: GoogleSignInResult = { status: "error", code: undefined };

function isFilled(value: unknown): value is string {
  return typeof value === "string" && value !== "";
}

export async function signInWithGoogle(): Promise<GoogleSignInResult> {
  // Metro inlines each EXPO_PUBLIC_ variable only where it is read by its full name.
  const iosClientId: unknown = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  const webClientId: unknown = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  if (!isFilled(iosClientId) || !isFilled(webClientId)) {
    return failure;
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
      return failure;
    }

    const { error } = await supabase.auth.signInWithIdToken({ provider: "google", token: idToken });

    return error === null
      ? { status: "signed-in" }
      : { status: "error", code: authErrorCode(error) };
  } catch (error) {
    if (__DEV__) {
      console.warn("Google sign-in failed", error);
    }

    return failure;
  }
}
