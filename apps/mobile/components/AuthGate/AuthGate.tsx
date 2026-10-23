import { isAuthRetryableFetchError } from "@supabase/supabase-js";
import { useRouter, useSegments } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";

import { useCancelRemindersWhenSignedOut } from "../../lib/reminderScheduler";
import { identifyUser } from "../../lib/sentry/identifyUser";
import { supabase } from "../../lib/supabase";
import { DeviceTimeZoneSync } from "../DeviceTimeZoneSync";
import { HealthImportRunner } from "../HealthImportRunner";
import { ReminderScheduler } from "../ReminderScheduler";
import { ReminderTapRouting } from "../ReminderTapRouting";
import { SessionCover } from "../SessionCover";
import { TermsGate } from "../TermsGate";

import type { AuthGateProps } from "./types";
import type { TermsGateState } from "../TermsGate";

const readNoStoredUserId = () => Promise.resolve(null);

export function AuthGate({ children, readStoredUserId = readNoStoredUserId }: AuthGateProps) {
  const router = useRouter();
  const segments = useSegments();
  // Whether someone is signed in. It is not "there is a session object": see the first effect.
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [isSessionLoaded, setIsSessionLoaded] = useState(false);
  const [termsGateState, setTermsGateState] = useState<TermsGateState>("open");

  useEffect(() => {
    let isCancelled = false;
    let hasSupabaseAnswered = false;
    // The account Sentry was last told about, so a refreshed session, which repeats it, is not told again.
    let identifiedUserId: string | null = null;
    const identify = (userId: string | null) => {
      if (userId !== identifiedUserId) {
        identifiedUserId = userId;
        identifyUser(userId);
      }
    };

    // A stored session whose access token has expired is refreshed as it is read. With no connection that
    // refresh is tried for about 25 seconds, and then Supabase answers with no session and a network error,
    // although the refresh token is still stored and still good. That is a person who is signed in and
    // offline, so the cached screens must open, and not after a 25 second wait. So:
    // 1. A session in the phone's storage opens the signed in screens at once, ahead of Supabase. This
    //    only ever shows what is already on the phone, and the answer below replaces it.
    // 2. Supabase's answer then decides. A session, or a network error (raised only when there is a stored
    //    session to refresh), is signed in. No session, a refused refresh token or any other auth error is
    //    signed out, and so is a start with nothing stored.
    // When the connection returns, Supabase refreshes the token, or finds it dead and signs out.
    // A read that fails is nothing stored, and Supabase's answer decides.
    void readStoredUserId()
      .catch(() => null)
      .then((userId) => {
        if (!isCancelled && !hasSupabaseAnswered && userId !== null) {
          identify(userId);
          setIsSignedIn(true);
          setIsSessionLoaded(true);
        }
      });

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!isCancelled) {
        hasSupabaseAnswered = true;
        // A lost connection leaves the stored account signed in, so it stays known. Any other answer with no
        // session means the stored account is not signed in.
        if (data.session !== null) {
          identify(data.session.user.id);
        } else if (!isAuthRetryableFetchError(error)) {
          identify(null);
        }
        setIsSignedIn(data.session !== null || isAuthRetryableFetchError(error));
        setIsSessionLoaded(true);
      }
    });

    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      // The first event repeats the answer above, and says no session for the offline start too. The read
      // above is the one that tells the two apart, so this event is not allowed to undo it.
      if (event === "INITIAL_SESSION" && nextSession === null) {
        return;
      }
      identify(nextSession?.user.id ?? null);
      setIsSignedIn(nextSession !== null);
    });

    return () => {
      isCancelled = true;
      data.subscription.unsubscribe();
    };
  }, [readStoredUserId]);

  // Reminders are made from one person's training, so they go when the session does, a dead one at start-up too.
  useCancelRemindersWhenSignedOut(isSessionLoaded && !isSignedIn);

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

    if (!isSignedIn && !isInAuthGroup && !isAuthCallback && !isStorybookRoute) {
      router.replace("/(auth)/sign-in");
    } else if (isSignedIn && isInAuthGroup) {
      router.replace("/(tabs)/dashboard");
    } else if (
      isSignedIn &&
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
  }, [isSessionLoaded, isSignedIn, firstSegment, router, isTermsGateBlocking]);

  // The children stay mounted so the navigator exists before the first redirect. The cover hides them until the stored session is read.
  // The terms gate is drawn over them the same way, and hides them from a screen reader, until the signed in
  // account is known to have accepted the current Terms. It mounts only with a session, so nothing reads
  // the acceptance for a signed out user. The time zone sync, the health import, the reminder scheduler and the
  // reminder tap routing mount with it, for the same reason.
  return (
    <>
      <View aria-hidden={termsGateState !== "open"} className="flex-1">
        {children}
      </View>
      {isSessionLoaded ? null : <SessionCover />}
      {isSessionLoaded && isSignedIn ? (
        <>
          <TermsGate onStateChange={setTermsGateState} />
          <DeviceTimeZoneSync />
          <HealthImportRunner />
          <ReminderScheduler />
          <ReminderTapRouting />
        </>
      ) : null}
    </>
  );
}
