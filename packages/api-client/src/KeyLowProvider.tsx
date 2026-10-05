"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createContext, useContext, useState } from "react";

import type { Database } from "./database.types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ReactNode } from "react";

const SupabaseContext = createContext<SupabaseClient<Database> | null>(null);

type KeyLowProviderProps = {
  client: SupabaseClient<Database>;
  queryClient?: QueryClient;
  children: ReactNode;
};

export function KeyLowProvider({ client, queryClient, children }: KeyLowProviderProps) {
  // The queryClient prop is read once, on the first render. Changing it later has no effect.
  const [resolvedQueryClient] = useState(() => queryClient ?? new QueryClient());

  return (
    <SupabaseContext.Provider value={client}>
      <QueryClientProvider client={resolvedQueryClient}>{children}</QueryClientProvider>
    </SupabaseContext.Provider>
  );
}

export function useSupabase(): SupabaseClient<Database> {
  const client = useContext(SupabaseContext);

  if (client === null) {
    throw new Error("useSupabase must be used within a KeyLowProvider");
  }

  return client;
}
