"use client";

import { MORE_SCREEN } from "@keylow/core/copy";

import type { SignOutRowProps } from "./types";

import { ListRow } from "@/components/ui/ListRow";
import { useSignOut } from "@/lib/auth/useSignOut";

/** The Account section's Sign out row. It works offline: see `endSession`. */
export function SignOutRow({ email }: SignOutRowProps) {
  const { isSigningOut, signOut } = useSignOut();

  return (
    <ListRow
      title={MORE_SCREEN.account.signOut}
      subtitle={email}
      chevron={false}
      loading={isSigningOut}
      onClick={() => {
        void signOut();
      }}
    />
  );
}
