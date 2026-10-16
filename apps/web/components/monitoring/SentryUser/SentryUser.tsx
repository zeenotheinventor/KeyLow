"use client";

import { setUser } from "@sentry/nextjs";
import { useEffect } from "react";

import type { SentryUserProps } from "./types";

/** Tells Sentry which account is signed in, by its id alone, for as long as it is on the page. */
export function SentryUser({ userId }: SentryUserProps) {
  useEffect(() => {
    setUser({ id: userId });
    return () => {
      setUser(null);
    };
  }, [userId]);

  return null;
}
