import { redirect } from "next/navigation";

import { SetPasswordForm } from "./SetPasswordForm";

import { createClient } from "@/lib/supabase/server";

export default async function SetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // The proxy already sends a signed out request to the login page. The caption needs an address, and
  // it is the session's own, never one from the URL.
  if (!user?.email) {
    redirect("/login");
  }

  return <SetPasswordForm email={user.email} />;
}
