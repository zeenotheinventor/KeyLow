import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

// There is no home page to draw. A signed-in user lands on the diary, as sign-in does, and anyone else signs in.
export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  redirect(user ? "/diary" : "/login");
}
