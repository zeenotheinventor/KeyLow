import { COMING_SOON_TITLE, MORE_SCREEN, TAB_TITLES } from "@keylow/core/copy";
import { cookies } from "next/headers";

import { signOut } from "../actions";
import { PageFrame } from "../PageFrame";
import { AppearanceSetting } from "./AppearanceSetting";
import { TargetsRow } from "./TargetsRow";

import { GroupedList } from "@/components/ui/GroupedList";
import { ListRow } from "@/components/ui/ListRow";
import { recipesPath } from "@/lib/recipeRoutes";
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
        <h1 className="text-h1">{TAB_TITLES.more}</h1>
        <GroupedList title={MORE_SCREEN.food.title} headerSize="compact">
          <ListRow
            title={MORE_SCREEN.food.yourFoods.title}
            subtitle={MORE_SCREEN.food.yourFoods.subtitle}
            href="/foods?scope=own"
          />
        </GroupedList>
        <GroupedList title={MORE_SCREEN.nutrition.title} headerSize="compact">
          <TargetsRow />
          <ListRow title={MORE_SCREEN.nutrition.recipes.title} href={recipesPath()} />
        </GroupedList>
        <GroupedList title={MORE_SCREEN.body.title} headerSize="compact">
          {/* Weight is not built yet. A disabled row has no destination and does nothing. */}
          <ListRow
            title={MORE_SCREEN.body.weight.title}
            subtitle={COMING_SOON_TITLE}
            href="/weight"
            disabled
            chevron={false}
          />
        </GroupedList>
        <GroupedList title={MORE_SCREEN.settings.title} headerSize="compact">
          <AppearanceSetting initialPreference={themePreference} />
          <ListRow title={MORE_SCREEN.settings.about.title} href="/about" />
        </GroupedList>
        <form action={signOut}>
          <GroupedList title={MORE_SCREEN.account.title} headerSize="compact">
            <ListRow
              title={MORE_SCREEN.account.signOut}
              subtitle={user?.email}
              submit
              chevron={false}
            />
          </GroupedList>
        </form>
      </div>
    </PageFrame>
  );
}
