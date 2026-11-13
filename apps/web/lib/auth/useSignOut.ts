"use client";

import { captureException } from "@sentry/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { endSession } from "./endSession";
import { removeStoredSession } from "./storedSession";

import { createClient } from "@/lib/supabase/client";

const LOGIN_PATH = "/login";

/**
 * Ends the session in this browser and goes to the login page. The login page is loaded ahead, so the
 * client navigation still works without a connection. The row and the button ignore a press while it ends.
 */
export function useSignOut() {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    router.prefetch(LOGIN_PATH);
  }, [router]);

  const signOut = async () => {
    setIsSigningOut(true);
    try {
      await endSession(createClient().auth, removeStoredSession);
    } catch (error) {
      // The person stays on the page with the row usable, and Sentry sees the failure.
      setIsSigningOut(false);
      captureException(error);
      return;
    }
    router.replace(LOGIN_PATH);
  };

  return { isSigningOut, signOut };
}
