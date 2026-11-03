import { KeyLowProvider } from "../../src/KeyLowProvider";
import { createTestClient } from "../createTestClient";
import { createQueryClient } from "./queryClients";

import type { Database } from "../../src/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ReactNode } from "react";

/**
 * A provider around a Supabase client (a fresh one unless given) and a query client that never
 * retries on its own. A hook that sets its own `retry` still retries, after `retryDelayMs` (0 by
 * default, so a test does not wait for the real back-off). `functionsUrl` is what a hook that calls an
 * Edge Function with its own fetch reads.
 */
export function createWrapper(
  client: SupabaseClient<Database> = createTestClient(),
  { retryDelayMs = 0, functionsUrl }: { retryDelayMs?: number; functionsUrl?: string } = {},
) {
  const queryClient = createQueryClient({
    defaultOptions: {
      queries: { retry: false, retryDelay: retryDelayMs },
      mutations: { retry: false },
    },
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <KeyLowProvider client={client} queryClient={queryClient} functionsUrl={functionsUrl}>
      {children}
    </KeyLowProvider>
  );

  return { client, queryClient, wrapper };
}
