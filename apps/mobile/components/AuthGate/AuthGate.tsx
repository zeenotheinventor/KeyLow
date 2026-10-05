import { useRouter, useSegments } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";

import { supabase } from "../../lib/supabase";

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

    if (session === null && !isInAuthGroup && !isAuthCallback) {
      router.replace("/(auth)/sign-in");
    } else if (session !== null && isInAuthGroup) {
      router.replace("/(tabs)/diary");
    }
  }, [isSessionLoaded, session, firstSegment, router]);

  // The children stay mounted so the navigator exists before the first redirect. The cover hides them until the stored session is read.
  return (
    <>
      {children}
      {isSessionLoaded ? null : <View className="absolute inset-0 bg-neutral-50" />}
    </>
  );
}
