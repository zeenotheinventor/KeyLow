import { ACCEPT_TERMS_SCREEN } from "@keylow/core/copy";

import { signOut } from "../../lib/signOut";
import { Button } from "../ui";

/** The gate's way out for someone who cannot or will not go on: a large ghost button that signs out. */
export function SignOutButton() {
  return (
    <Button
      variant="ghost"
      size="lg"
      fullWidth
      onPress={() => {
        void signOut();
      }}
    >
      {ACCEPT_TERMS_SCREEN.signOutLabel}
    </Button>
  );
}
