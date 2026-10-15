import { acceptTerms } from "@keylow/api-client";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { Platform } from "react-native";

import { authErrorCode } from "./authErrorCode";
import { supabase } from "./supabase";
import { holdTermsGate } from "./termsGateHold";

/**
 * An error carries a code for `describeAuthError`, never a message. Only a failure Supabase answered has
 * one. A client id that is not set, a sheet that fails and a missing ID token have none, so they read as
 * the generic sentence.
 */
export type GoogleSignInResult =
  { status: "signed-in" } | { status: "cancelled" } | { status: "error"; code: string | undefined };

/**
 * `acceptedTermsVersion` is set by the sign-up screen alone. It records that version as accepted once
 * the sign-in has succeeded, because the person ticked the box before pressing the button. The
 * accept-to-continue gate is held on its loading state from before the sign-in until the acceptance is
 * recorded and `refreshTermsAcceptance` has read it again, so the gate never sees the session without it.
 */
export type GoogleSignInOptions = {
  acceptedTermsVersion?: string | undefined;
  /** Makes the app read the acceptance again, and settles when it has. Called after the acceptance is recorded. */
  refreshTermsAcceptance?: (() => Promise<unknown>) | undefined;
};

const failure: GoogleSignInResult = { status: "error", code: undefined };

function isFilled(value: unknown): value is string {
  return typeof value === "string" && value !== "";
}

// A failure here must not undo a sign-in that worked, and it says nothing to the person: the gate that asks
// for the terms to be accepted catches an account with no acceptance recorded.
async function recordAcceptance(
  version: string,
  refreshTermsAcceptance: (() => Promise<unknown>) | undefined,
): Promise<void> {
  try {
    await acceptTerms(supabase, version);
    // The gate read the acceptance when the session arrived, before this call, so it holds the old answer.
    await refreshTermsAcceptance?.();
  } catch (error) {
    if (__DEV__) {
      console.warn("Recording the terms acceptance failed", error);
    }
  }
}

export async function signInWithGoogle({
  acceptedTermsVersion,
  refreshTermsAcceptance,
}: GoogleSignInOptions = {}): Promise<GoogleSignInResult> {
  // Metro inlines each EXPO_PUBLIC_ variable only where it is read by its full name.
  const iosClientId: unknown = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  const webClientId: unknown = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  if (!isFilled(iosClientId) || !isFilled(webClientId)) {
    return failure;
  }

  let releaseTermsGate: (() => void) | undefined;

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

    // Held before the sign-in, because the session it starts reaches the gate before the acceptance exists.
    releaseTermsGate = acceptedTermsVersion === undefined ? undefined : holdTermsGate();
    const { error } = await supabase.auth.signInWithIdToken({ provider: "google", token: idToken });

    if (error !== null) {
      return { status: "error", code: authErrorCode(error) };
    }

    if (acceptedTermsVersion !== undefined) {
      await recordAcceptance(acceptedTermsVersion, refreshTermsAcceptance);
    }

    return { status: "signed-in" };
  } catch (error) {
    if (__DEV__) {
      console.warn("Google sign-in failed", error);
    }

    return failure;
  } finally {
    releaseTermsGate?.();
  }
}
