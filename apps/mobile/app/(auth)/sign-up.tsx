import { AUTH_SCREEN } from "@keylow/core/copy";

import { AuthForm } from "../../components/AuthForm";
import { authErrorCode } from "../../lib/authErrorCode";
import { supabase } from "../../lib/supabase";

import type { AuthFormOutcome } from "../../components/AuthForm";
import type { Credentials } from "../../lib/validateCredentials";

// Matches the redirect URL registered in the Supabase auth config and the scheme in app.json.
const authCallbackUrl = "keylow://auth/callback";

async function signUp(credentials: Credentials): Promise<AuthFormOutcome> {
  const { data, error } = await supabase.auth.signUp({
    ...credentials,
    options: { emailRedirectTo: authCallbackUrl },
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
  return (
    <AuthForm
      heading={AUTH_SCREEN.signUp.heading}
      submitLabel={AUTH_SCREEN.signUp.submitLabel}
      passwordRule="minLength"
      onSubmit={signUp}
      footer={{
        prompt: AUTH_SCREEN.signUp.footerPrompt,
        linkLabel: AUTH_SCREEN.signUp.footerLink,
        href: "/(auth)/sign-in",
      }}
    />
  );
}
