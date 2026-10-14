import { signOut } from "../actions";

import { GroupedList } from "@/components/ui/GroupedList";
import { ListRow } from "@/components/ui/ListRow";
import { createClient } from "@/lib/supabase/server";

export default async function MorePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <h1 className="text-h1">More</h1>
      <GroupedList title="Body">
        <ListRow title="Weight" href="/weight" />
      </GroupedList>
      <GroupedList title="Settings">
        <ListRow title="Settings" href="/settings" />
      </GroupedList>
      <form action={signOut}>
        <GroupedList title="Account">
          <ListRow title="Sign out" subtitle={user?.email} submit chevron={false} />
        </GroupedList>
      </form>
    </div>
  );
}
