"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useState } from "react";

import type { Database } from "./database.types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ReactNode } from "react";

const SupabaseContext = createContext<SupabaseClient<Database> | null>(null);

/**
 * The provider outlives a sign-out (the phone keeps one for the whole process), so without this
 * the next person to sign in would read the last person's cached data, terms acceptance included.
 * The cache is reset on sign out and when a different user signs in: every query goes back to
 * having no data, and the ones on screen refetch at once, so none keeps showing the last user's
 * data (`clear` would leave them doing so until they next render). Supabase repeats `SIGNED_IN`
 * on a token refresh and when the app regains focus, so the same user again keeps the cache.
 * Returns what stops listening.
 */
function resetCacheWhenTheUserChanges(client: SupabaseClient<Database>, queryClient: QueryClient) {
  // undefined until the first event says who is signed in, which is not a change.
  let knownUserId: string | null | undefined;

  const { data } = client.auth.onAuthStateChange((event, session) => {
    const userId = session?.user.id ?? null;
    const userChanged = knownUserId !== undefined && knownUserId !== userId;

    if (event === "SIGNED_OUT" || userChanged) {
      void queryClient.resetQueries();
    }

    knownUserId = userId;
  });

  return () => {
    data.subscription.unsubscribe();
  };
}

type KeyLowProviderProps = {
  client: SupabaseClient<Database>;
  queryClient?: QueryClient;
  children: ReactNode;
};

export function KeyLowProvider({ client, queryClient, children }: KeyLowProviderProps) {
  // The queryClient prop is read once, on the first render. Changing it later has no effect.
  const [resolvedQueryClient] = useState(() => queryClient ?? new QueryClient());

  useEffect(
    () => resetCacheWhenTheUserChanges(client, resolvedQueryClient),
    [client, resolvedQueryClient],
  );

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
