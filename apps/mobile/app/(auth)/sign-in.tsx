import { Link } from "expo-router";
import { Text } from "react-native";

import { AuthForm } from "../../components/AuthForm";
import { supabase } from "../../lib/supabase";

import type { AuthFormOutcome } from "../../components/AuthForm";
import type { Credentials } from "../../lib/validateCredentials";

async function signIn(credentials: Credentials): Promise<AuthFormOutcome> {
  const { error } = await supabase.auth.signInWithPassword(credentials);

  return error === null ? { status: "done" } : { status: "error", message: error.message };
}

export default function SignInRoute() {
  return (
    <AuthForm
      heading="Welcome back"
      submitLabel="Sign in"
      passwordRule="required"
      onSubmit={signIn}
      footer={
        <>
          <Text className="text-sm text-legacy-neutral-500">New to KeyLow?</Text>
          <Link
            href="/(auth)/sign-up"
            className="py-3 text-base font-semibold text-legacy-brand-600"
          >
            Create account
          </Link>
        </>
      }
    />
  );
}
