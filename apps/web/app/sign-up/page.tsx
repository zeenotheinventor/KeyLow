import { SIGN_UP_SCREEN } from "@keylow/core/copy";

import { SignUpForm } from "./SignUpForm";

import { AuthSwitchLink } from "@/components/auth/AuthSwitchLink";
import { Card } from "@/components/ui/Card";
import { KiLoMark } from "@/components/ui/KiLoMark";

export default function SignUpPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-6">
      <Card padding="none" className="flex w-full max-w-md flex-col gap-[14px] p-6 sm:p-8">
        <div className="flex flex-col items-start gap-1.5">
          <KiLoMark className="size-10" />
          <h1 className="text-h1">{SIGN_UP_SCREEN.heading}</h1>
          <p className="text-caption text-text-secondary">{SIGN_UP_SCREEN.caption}</p>
        </div>
        <SignUpForm />
        <AuthSwitchLink
          prompt={SIGN_UP_SCREEN.footerPrompt}
          linkLabel={SIGN_UP_SCREEN.footerLink}
          href="/login"
        />
      </Card>
    </main>
  );
}
