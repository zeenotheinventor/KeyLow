import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-md bg-brand-500 text-neutral-50">
        <CardHeader>
          <h1 className="text-3xl font-semibold">KeyLow</h1>
        </CardHeader>
        <CardContent className="flex flex-col items-start gap-4">
          <p>The web app is running.</p>
          <Button asChild variant="secondary">
            <Link href={user ? "/diary" : "/login"}>{user ? "Open the dashboard" : "Sign in"}</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
