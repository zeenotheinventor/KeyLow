import type { ReactNode } from "react";

export type AuthGateProps = {
  /**
   * Whose session is stored on the phone, read from its storage and not the network. It lets the gate
   * open the signed in screens at once when the network is down. Without it the gate waits for Supabase.
   */
  readStoredUserId?: () => Promise<string | null>;
  children: ReactNode;
};
