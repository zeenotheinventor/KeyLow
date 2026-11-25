import { redirect } from "next/navigation";

import { PageFrame } from "../../PageFrame";

import { ChangePasswordScreen } from "@/components/account";
import { createClient } from "@/lib/supabase/server";

export default async function ChangePasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // The dashboard layout already sends a signed out request to the login page. The caption needs an address.
  if (!user?.email) {
    redirect("/login");
  }

  return (
    <PageFrame variant="shell">
      <ChangePasswordScreen email={user.email} />
    </PageFrame>
  );
}
