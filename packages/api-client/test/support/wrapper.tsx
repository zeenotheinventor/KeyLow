import { QueryClient } from "@tanstack/react-query";

import { KeyLowProvider } from "../../src/KeyLowProvider";
import { createTestClient } from "../createTestClient";

import type { ReactNode } from "react";

/** A provider around a fresh Supabase client and a query client that never retries. */
export function createWrapper() {
  const client = createTestClient();
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
