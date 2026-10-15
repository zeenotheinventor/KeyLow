import { keys } from "@keylow/api-client";
import { SIGN_UP_SCREEN, TERMS_VERSION } from "@keylow/core/copy";
import { useQueryClient } from "@tanstack/react-query";

import { AuthForm } from "../../components/AuthForm";
import { authErrorCode } from "../../lib/authErrorCode";
import { signInWithGoogle } from "../../lib/googleSignIn";
import { supabase } from "../../lib/supabase";

import type { AuthFormOutcome } from "../../components/AuthForm";
import type { Credentials } from "../../lib/validateCredentials";

// Matches the redirect URL registered in the Supabase auth config and the scheme in app.json.
const authCallbackUrl = "keylow://auth/callback";

async function signUp(credentials: Credentials): Promise<AuthFormOutcome> {
  const { data, error } = await supabase.auth.signUp({
    ...credentials,
    // The profile trigger records the acceptance from the version in the user's metadata.
    options: { emailRedirectTo: authCallbackUrl, data: { terms_version: TERMS_VERSION } },
  });

  if (error !== null) {
    return { status: "error", code: authErrorCode(error) };
  }

  // With confirm-email on there is no session yet. Otherwise the AuthGate redirects on the new session.
  return data.session === null
    ? { status: "check-email", email: credentials.email }
    : { status: "done" };
}

export default function SignUpRoute() {
  const queryClient = useQueryClient();

  // The box was ticked before the button could be pressed, so the account Google makes is accepted at once.
  // The AuthGate's gate read the acceptance when the session arrived, so it is read again once recorded.
  const signUpWithGoogle = () =>
    signInWithGoogle({
      acceptedTermsVersion: TERMS_VERSION,
      refreshTermsAcceptance: () =>
        queryClient.invalidateQueries({ queryKey: keys.profiles.termsAcceptance }),
    });

  return (
    <AuthForm
      heading={SIGN_UP_SCREEN.heading}
      submitLabel={SIGN_UP_SCREEN.submitLabel}
      passwordRule="minLength"
      requireAcceptance
      onSubmit={signUp}
      onGoogleSignIn={signUpWithGoogle}
      footer={{
        prompt: SIGN_UP_SCREEN.footerPrompt,
        linkLabel: SIGN_UP_SCREEN.footerLink,
        href: "/(auth)/sign-in",
      }}
    />
  );
}
