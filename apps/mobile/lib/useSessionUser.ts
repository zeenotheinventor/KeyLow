import { useEffect, useState } from "react";

import { supabase } from "./supabase";

import type { User } from "@supabase/supabase-js";

/**
 * The signed in account, read from the session the phone already holds and kept in step with it. It is null
 * until the session has been read, and when there is none. It makes no request of its own.
 */
export function useSessionUser(): User | null {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    let isCancelled = false;

    void supabase.auth.getSession().then(({ data }) => {
      if (!isCancelled) {
        setUser(data.session?.user ?? null);
      }
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      isCancelled = true;
      data.subscription.unsubscribe();
    };
  }, []);

  return user;
}
