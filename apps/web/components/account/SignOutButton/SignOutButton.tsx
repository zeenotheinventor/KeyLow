"use client";

import type { SignOutButtonProps } from "./types";

import { Button } from "@/components/ui/Button";
import { useSignOut } from "@/lib/auth/useSignOut";

/** The Sign out button on the accept-terms page. It works offline: see `endSession`. */
export function SignOutButton({ children }: SignOutButtonProps) {
  const { isSigningOut, signOut } = useSignOut();

  return (
    <Button
      type="button"
      variant="ghost"
      loading={isSigningOut}
      onClick={() => {
        void signOut();
      }}
    >
      {children}
    </Button>
  );
}
