import { useRouter, useSegments } from "expo-router";
import { useEffect, useState } from "react";

import { supabase } from "../../lib/supabase";
import { SessionCover } from "../SessionCover";

import type { AuthGateProps } from "./types";
import type { Session } from "@supabase/supabase-js";

export function AuthGate({ children }: AuthGateProps) {
  const router = useRouter();
  const segments = useSegments();
  const [session, setSession] = useState<Session | null>(null);
  const [isSessionLoaded, setIsSessionLoaded] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    void supabase.auth.getSession().then(({ data }) => {
      if (!isCancelled) {
        setSession(data.session);
        setIsSessionLoaded(true);
      }
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      isCancelled = true;
      data.subscription.unsubscribe();
    };
  }, []);

  const firstSegment: string | undefined = segments[0];

  useEffect(() => {
    if (!isSessionLoaded) {
      return;
    }

    const isInAuthGroup = firstSegment === "(auth)";
    const isAuthCallback = firstSegment === "auth";
    // Storybook needs no sign-in, and only a build made with the flag has anything on that route.
    const isStorybookRoute =
      firstSegment === "storybook" && process.env.EXPO_PUBLIC_STORYBOOK === "true";

    if (session === null && !isInAuthGroup && !isAuthCallback && !isStorybookRoute) {
      router.replace("/(auth)/sign-in");
    } else if (session !== null && isInAuthGroup) {
      router.replace("/(tabs)/dashboard");
    }
  }, [isSessionLoaded, session, firstSegment, router]);

  // The children stay mounted so the navigator exists before the first redirect. The cover hides them until the stored session is read.
  return (
    <>
      {children}
      {isSessionLoaded ? null : <SessionCover />}
    </>
  );
}
