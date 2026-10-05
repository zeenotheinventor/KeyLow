import { Link } from "expo-router";
import { Text } from "react-native";

import { AuthForm } from "../../components/AuthForm";
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
    return { status: "error", message: error.message };
  }

  // With confirm-email on there is no session yet. Otherwise the AuthGate redirects on the new session.
  return data.session === null
    ? { status: "notice", message: "Check your email to confirm your account" }
    : { status: "done" };
}

export default function SignUpRoute() {
  return (
    <AuthForm
      heading="Create your account"
      submitLabel="Create account"
      passwordRule="minLength"
      onSubmit={signUp}
      footer={
        <>
          <Text className="text-sm text-neutral-500">Already have an account?</Text>
          <Link href="/(auth)/sign-in" className="py-3 text-base font-semibold text-brand-600">
            Sign in
          </Link>
        </>
      }
    />
  );
}
