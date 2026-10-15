import { cookies } from "next/headers";

import { signOut } from "../actions";
import { PageFrame } from "../PageFrame";
import { AppearanceSetting } from "./AppearanceSetting";

import { GroupedList } from "@/components/ui/GroupedList";
import { ListRow } from "@/components/ui/ListRow";
import { createClient } from "@/lib/supabase/server";
import { THEME_COOKIE_NAME, themeFromCookie } from "@/lib/theme/themeCookie";

export default async function MorePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const cookieStore = await cookies();
  const themePreference = themeFromCookie(cookieStore.get(THEME_COOKIE_NAME)?.value);

  return (
    <PageFrame variant="shell">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
        <h1 className="text-h1">More</h1>
        <GroupedList title="Food" headerSize="compact">
          <ListRow
            title="Your foods"
            subtitle="Foods you created or copied"
            href="/foods?scope=own"
          />
        </GroupedList>
        <GroupedList title="Body" headerSize="compact">
          {/* Weight is not built yet. A disabled row has no destination and does nothing. */}
          <ListRow title="Weight" subtitle="Coming soon" href="/weight" disabled chevron={false} />
        </GroupedList>
        <GroupedList title="Settings" headerSize="compact">
          <AppearanceSetting initialPreference={themePreference} />
          <ListRow title="About" href="/about" />
        </GroupedList>
        <form action={signOut}>
          <GroupedList title="Account" headerSize="compact">
            <ListRow title="Sign out" subtitle={user?.email} submit chevron={false} />
          </GroupedList>
        </form>
      </div>
    </PageFrame>
  );
}
