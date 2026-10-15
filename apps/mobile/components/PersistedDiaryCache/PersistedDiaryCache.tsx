import { useSupabase } from "@keylow/api-client";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { useEffect, useRef, useState } from "react";

import {
  DIARY_CACHE_BUSTER,
  DIARY_CACHE_MAX_AGE_MS,
  createDiaryCachePersister,
  isPersistedQuery,
} from "../../lib/diaryCache";

import type { PersistedDiaryCacheProps } from "./types";

/**
 * Keeps the diary reads on the phone, so the diary opens at once and without a connection. The
 * stored cache is read before any query runs, and the queries it holds show their data while they
 * refresh. Only the families `isPersistedQuery` lists are stored, no write is, and web does not use
 * this. It sits inside `KeyLowProvider`, whose query client it persists, and outside the sign-in gate,
 * so the gate's own read finds the stored acceptance.
 *
 * On a sign out, which is also how an account deletion ends, the stored cache is removed and the one in
 * memory is reset, so the next person to sign in never sees it. A start with no session it can read
 * does not clear it: offline, with an access token that has expired, Supabase reports no session
 * although the person is still signed in, and that is when the cache is wanted.
 */
export function PersistedDiaryCache({ children, readStoredUserId }: PersistedDiaryCacheProps) {
  const client = useSupabase();
  const queryClient = useQueryClient();
  const [persister] = useState(() => createDiaryCachePersister(AsyncStorage, readStoredUserId));
  const hasSeenSignOut = useRef(false);

  useEffect(() => {
    const { data } = client.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        hasSeenSignOut.current = true;
        void persister.removeClient();
        void queryClient.resetQueries();
      }
    });

    return () => {
      data.subscription.unsubscribe();
    };
  }, [client, persister, queryClient]);

  return (
    <PersistQueryClientProvider
      client={queryClient}
      // A sign out can come before the stored cache has been read, and the read then fills
      // the cache after the reset. So the reset is made again once the read is done.
      onSuccess={() => {
        if (hasSeenSignOut.current) {
          void queryClient.resetQueries();
        }
      }}
      persistOptions={{
        persister,
        maxAge: DIARY_CACHE_MAX_AGE_MS,
        buster: DIARY_CACHE_BUSTER,
        dehydrateOptions: {
          shouldDehydrateQuery: isPersistedQuery,
          // A write waits for a connection, and is never replayed from storage.
          shouldDehydrateMutation: () => false,
        },
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
