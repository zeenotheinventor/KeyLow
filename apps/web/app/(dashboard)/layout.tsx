import { redirect } from "next/navigation";

import { DashboardNav } from "./DashboardNav";
import { Providers } from "./Providers";

import type { ReactNode } from "react";

import { SentryUser } from "@/components/monitoring/SentryUser";
import { createClient } from "@/lib/supabase/server";
import { hasCurrentTermsAcceptance } from "@/lib/terms";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // A signed in account with no current acceptance (or an unreadable one) accepts first. The page
  // always sends them on to the dashboard, because a layout cannot see which page was asked for.
  if (!(await hasCurrentTermsAcceptance(supabase))) {
    redirect("/accept-terms");
  }

  return (
    <Providers>
      <SentryUser userId={user.id} />
      <DashboardNav />
      <main className="px-4 lg:px-8">{children}</main>
    </Providers>
  );
}
