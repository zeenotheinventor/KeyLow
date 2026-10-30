import { ACCEPT_TERMS_SCREEN } from "@keylow/core/copy";
import { redirect } from "next/navigation";

import { AcceptTermsForm } from "./AcceptTermsForm";

import { signOut } from "@/app/(dashboard)/actions";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { KiLoMark } from "@/components/ui/KiLoMark";
import { createClient } from "@/lib/supabase/server";
import { hasCurrentTermsAcceptance } from "@/lib/terms";

export default async function AcceptTermsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  if (await hasCurrentTermsAcceptance(supabase)) {
    redirect("/dashboard");
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-6">
      <Card padding="none" className="flex w-full max-w-[340px] flex-col gap-[14px] p-6">
        <div className="flex flex-col items-start gap-1.5">
          <KiLoMark wordmark className="size-10" />
          <h1 className="text-h1">{ACCEPT_TERMS_SCREEN.heading}</h1>
          <p className="text-caption text-text-secondary">{ACCEPT_TERMS_SCREEN.caption}</p>
        </div>
        <AcceptTermsForm />
        <form action={signOut} className="flex flex-col">
          <Button type="submit" variant="ghost">
            {ACCEPT_TERMS_SCREEN.signOutLabel}
          </Button>
        </form>
      </Card>
    </main>
  );
}
