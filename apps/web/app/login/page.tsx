import { AUTH_SCREEN, SIGN_IN_LINK_NOT_VERIFIED } from "@keylow/core/copy";

import { LoginForm } from "./LoginForm";

import { AuthCard } from "@/components/auth/AuthCard";
import { AuthSwitchLink } from "@/components/auth/AuthSwitchLink";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <AuthCard heading="Sign in to Ki-Lo">
      <LoginForm linkError={error === undefined ? undefined : SIGN_IN_LINK_NOT_VERIFIED} />
      <AuthSwitchLink
        prompt={AUTH_SCREEN.signIn.footerPrompt}
        linkLabel={AUTH_SCREEN.signIn.footerLink}
        href="/sign-up"
      />
    </AuthCard>
  );
}
