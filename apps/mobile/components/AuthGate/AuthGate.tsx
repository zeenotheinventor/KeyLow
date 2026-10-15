import { useRouter, useSegments } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";

import { supabase } from "../../lib/supabase";
import { DeviceTimeZoneSync } from "../DeviceTimeZoneSync";
import { SessionCover } from "../SessionCover";
import { TermsGate } from "../TermsGate";

import type { AuthGateProps } from "./types";
import type { TermsGateState } from "../TermsGate";
import type { Session } from "@supabase/supabase-js";

export function AuthGate({ children }: AuthGateProps) {
  const router = useRouter();
  const segments = useSegments();
  const [session, setSession] = useState<Session | null>(null);
  const [isSessionLoaded, setIsSessionLoaded] = useState(false);
  const [termsGateState, setTermsGateState] = useState<TermsGateState>("open");

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
  // A gate still loading has not decided yet, so a deep link to a modal is kept for an account that turns out to have accepted.
  const isTermsGateBlocking = termsGateState === "failed" || termsGateState === "accept";

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
    } else if (
      session !== null &&
      isTermsGateBlocking &&
      firstSegment !== "(tabs)" &&
      !isAuthCallback &&
      !isStorybookRoute
    ) {
      // A route outside the tabs may be a native modal, such as the food search sheet, which iOS draws above
      // the terms gate's cover. So while the gate blocks the account, every route outside the tabs (the root route, which only redirects there, included) is left for the dashboard.
      // The navigator stays mounted, so this is an ordinary replace.
      router.replace("/(tabs)/dashboard");
    }
  }, [isSessionLoaded, session, firstSegment, router, isTermsGateBlocking]);

  // The children stay mounted so the navigator exists before the first redirect. The cover hides them until the stored session is read.
  // The terms gate is drawn over them the same way, and hides them from a screen reader, until the signed in
  // account is known to have accepted the current Terms. It mounts only with a session, so nothing reads
  // the acceptance for a signed out user. The time zone sync mounts with it, for the same reason.
  return (
    <>
      <View aria-hidden={termsGateState !== "open"} className="flex-1">
        {children}
      </View>
      {isSessionLoaded ? null : <SessionCover />}
      {isSessionLoaded && session !== null ? (
        <>
          <TermsGate onStateChange={setTermsGateState} />
          <DeviceTimeZoneSync />
        </>
      ) : null}
    </>
  );
}
