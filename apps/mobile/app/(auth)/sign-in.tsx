import { AUTH_SCREEN } from "@keylow/core/copy";
import { useRouter } from "expo-router";

import { AuthForm } from "../../components/AuthForm";
import { authErrorCode } from "../../lib/authErrorCode";
import { setForgotPasswordEmail } from "../../lib/forgotPasswordEmail";
import { supabase } from "../../lib/supabase";

import type { AuthFormOutcome } from "../../components/AuthForm";
import type { Credentials } from "../../lib/validateCredentials";

async function signIn(credentials: Credentials): Promise<AuthFormOutcome> {
  const { error } = await supabase.auth.signInWithPassword(credentials);

  return error === null ? { status: "done" } : { status: "error", code: authErrorCode(error) };
}

export default function SignInRoute() {
  const router = useRouter();

  return (
    <AuthForm
      heading={AUTH_SCREEN.signIn.heading}
      submitLabel={AUTH_SCREEN.signIn.submitLabel}
      passwordRule="required"
      onSubmit={signIn}
      onForgotPassword={(typedEmail) => {
        setForgotPasswordEmail(typedEmail);
        router.push("/(auth)/forgot-password");
      }}
      footer={{
        prompt: AUTH_SCREEN.signIn.footerPrompt,
        linkLabel: AUTH_SCREEN.signIn.footerLink,
        href: "/(auth)/sign-up",
      }}
    />
  );
}
