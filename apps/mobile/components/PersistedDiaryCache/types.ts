import type { ReactNode } from "react";

export type PersistedDiaryCacheProps = {
  /** Whose session is stored on the phone, from the phone's own storage and not the network. */
  readStoredUserId: () => Promise<string | null>;
  children: ReactNode;
};
