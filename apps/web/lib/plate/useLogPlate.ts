import {
  PlateFoodGoneError,
  PlateFoodNeedsReviewError,
  useLogPlateEntries,
  useProfileTimeZone,
} from "@keylow/api-client";
import { FOOD_NOT_FOUND, FOOD_REVIEW_BANNER, PLATE, describeLoggedPlate } from "@keylow/core/copy";
import { canLogPlate, plateItemName, plateLoggedAt } from "@keylow/core/plate";
import { Check, CircleAlert } from "lucide-react";

import { usePlate } from "./usePlate";

import { useToast } from "@/components/ui/Toast";
import { useIsOnline } from "@/lib/useIsOnline";

/** `wasIgnored` is set when nothing was tried: a log was already running, or the plate could not be logged yet. */
export type LogPlateResult = { ok: true } | { ok: false; wasIgnored?: true };

// What the toast says when the log failed: the food is gone, the food needs review, or the write did not go through.
function refusalOf(error: unknown): string {
  if (error instanceof PlateFoodGoneError) {
    return FOOD_NOT_FOUND.body;
  }
  if (error instanceof PlateFoodNeedsReviewError) {
    return FOOD_REVIEW_BANNER.title;
  }

  return PLATE.notLogged;
}

/**
 * The one action that logs the plate. `logPlate` reads the foods on the plate, logs every row in one
 * all-or-nothing write at the plate's time on the dialog's day, and on success shows the logged toast and calls
 * `onLogged`, which closes the dialog. A failed log writes nothing, keeps the plate and says so in a toast: a
 * food that is gone says so, and one that needs review says that, and any other failure says it was not logged.
 * It never throws, and a call that did nothing because a log was running, or the plate could not be logged,
 * says so with `wasIgnored` and needs no sentence. Nothing from the plate goes into an error, a log or a breadcrumb.
 */
export function useLogPlate(
  day: string | undefined,
  onLogged: () => void,
): { logPlate: () => Promise<LogPlateResult>; canLog: boolean } {
  const { items, time, isLogging, startLogging, finishLogging } = usePlate();
  const toast = useToast();
  const isOnline = useIsOnline();
  const { mutateAsync } = useLogPlateEntries();
  const profileTimeZone = useProfileTimeZone();
  // The time is read in the profile's zone, so the plate cannot be logged before the zone is known.
  const timeZone = profileTimeZone.data === undefined ? undefined : (profileTimeZone.data ?? "UTC");
  const canLog = canLogPlate(items) && isOnline && timeZone !== undefined && !isLogging;

  async function logPlate(): Promise<LogPlateResult> {
    if (!canLog || !startLogging()) {
      return { ok: false, wasIgnored: true };
    }
    try {
      // "Now" is the moment Log is pressed.
      const { loggedAt, localDate } = plateLoggedAt({ now: new Date(), day, time, timeZone });
      await mutateAsync({ items, loggedAt: loggedAt.toISOString(), localDate });
    } catch (error) {
      // The failure is not kept: it can quote a food or an amount, which is health data. A food that is gone, or
      // that needs review, is not a connection problem, so it does not say to check the connection.
      finishLogging();
      toast.show({ message: refusalOf(error), tone: "danger", icon: CircleAlert });

      return { ok: false };
    }
    // The plate is logged, so the log stays held: the dialog is closing, and a second press in that time
    // would log the plate again.
    toast.show({
      message: describeLoggedPlate(items.map(plateItemName)),
      tone: "success",
      icon: Check,
    });
    onLogged();

    return { ok: true };
  }

  return { logPlate, canLog };
}
