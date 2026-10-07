import { QueryClient } from "@tanstack/react-query";

import { KeyLowProvider } from "../../src/KeyLowProvider";
import { createTestClient } from "../createTestClient";

import type { Database } from "../../src/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ReactNode } from "react";

/** A provider around a Supabase client (a fresh one unless given) and a query client that never retries. */
export function createWrapper(client: SupabaseClient<Database> = createTestClient()) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <KeyLowProvider client={client} queryClient={queryClient}>
      {children}
    </KeyLowProvider>
  );

  return { client, queryClient, wrapper };
}
