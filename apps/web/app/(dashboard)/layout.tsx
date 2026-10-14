import { redirect } from "next/navigation";

import { DashboardNav } from "./DashboardNav";
import { Providers } from "./Providers";

import type { ReactNode } from "react";

import { createClient } from "@/lib/supabase/server";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <Providers>
      <DashboardNav />
      <main className="px-4 lg:px-8">{children}</main>
    </Providers>
  );
}
