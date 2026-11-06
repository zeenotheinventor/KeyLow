"use client";

import { useRunCheckinsIfDue } from "@keylow/api-client";
import { captureException } from "@sentry/nextjs";
import { useEffect } from "react";

import { announceNewTargets, takeNewTargets } from "@/lib/checkinToast";

// The code goes as a tag because the report scrubbing drops every error message, and the code is all that is sent.
function reportFailureCode(code: string) {
  captureException(new Error("Could not run your check-in"), {
    tags: { checkinFailureCode: code },
  });
}

/**
 * Draws nothing. Runs the user's due check-ins when the page opens and each time the tab returns to view, so the
 * new targets are there before the Diary is looked at: `useRunCheckinsIfDue` reads the programme's next check-in
 * date, and when that day has come in the profile's time zone it runs the check-ins once (a return to the tab
 * while one runs joins it). Nothing runs while the tab is in the background, and the Terms are the layout's gate.
 * Offline it does nothing and says nothing, and a connection that returns while the tab is in view does not run
 * it, as the phone's returning to the foreground is what runs it there. Any failure shows nothing and goes to
 * Sentry as a code only, since the daily backstop runs the check-in anyway. When a run recorded check-ins and the
 * calorie target is not what it was, it tells the Diary a new target exists, and forgets that when it unmounts
 * (the person signed out). Mount it once, where a person is signed in.
 */
export function CheckinRunner() {
  const runIfDue = useRunCheckinsIfDue({
    onNewTargets: announceNewTargets,
    onFailureCode: reportFailureCode,
  });

  useEffect(() => {
    function runWhenInView() {
      if (document.visibilityState === "visible") {
        void runIfDue();
      }
    }

    runWhenInView();
    document.addEventListener("visibilitychange", runWhenInView);

    return () => {
      document.removeEventListener("visibilitychange", runWhenInView);
    };
  }, [runIfDue]);

  // The runner lives in the dashboard layout, so it only unmounts on the way out (sign-out). A new target
  // still waiting then belongs to the account that left, and the next one must not be told of it. A move
  // between dashboard pages keeps the runner, so a toast waiting for the next Diary visit is kept.
  useEffect(
    () => () => {
      takeNewTargets();
    },
    [],
  );

  return null;
}
