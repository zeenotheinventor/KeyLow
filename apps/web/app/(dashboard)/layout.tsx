import { redirect } from "next/navigation";

import { signOut } from "./actions";
import { DashboardNav } from "./DashboardNav";
import { Providers } from "./Providers";

import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
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
      <header className="flex flex-wrap items-center justify-between gap-2 border-b p-4">
        <DashboardNav />
        <form action={signOut}>
          <Button type="submit" variant="outline" className="h-11 md:h-9">
            Sign out
          </Button>
        </form>
      </header>
      <main className="p-4 md:p-6">{children}</main>
    </Providers>
  );
}
