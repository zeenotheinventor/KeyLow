import { useLogPlateEntries, useProfileTimeZone } from "@keylow/api-client";
import { describeLoggedPlate } from "@keylow/core/copy";
import { formatClockTime, parseClockTime } from "@keylow/core/dates";
import { clockTimeOn, openingLoggedAt } from "@keylow/core/diary";
import { plateItemName } from "@keylow/core/plate";
import { useRouter } from "expo-router";
import { useCallback } from "react";

import { usePlate, usePlateLoggingGuard } from "./usePlate";
import { useToast } from "../../components/ui";
import { diaryHref, useCloseFoodsSheet } from "../navigation";
import { useReadsEnabled } from "../useReadsEnabled";

import type { LogPlateResult } from "./types";
import type { LogContext } from "@keylow/core/diary";

/**
 * The one action that logs the plate. `logPlate` reads the foods on the plate, logs every row in one
 * all-or-nothing write at the plate's time on the sheet's day, and on success shows the toast and takes the
 * person to the diary at that hour, closing the sheet (and so the plate). It never throws: `{ ok: false }`
 * means nothing was written and the plate is as it was, and the caller says so where its board does. A call
 * that did nothing because a log was running, or the plate could not be logged, has `wasIgnored` set and
 * needs no sentence. Nothing from the plate goes into an error, a log or a breadcrumb.
 */
export function useLogPlate(context: LogContext | undefined): {
  logPlate: () => Promise<LogPlateResult>;
} {
  const plate = usePlate();
  const router = useRouter();
  const toast = useToast();
  const closeSheet = useCloseFoodsSheet();
  const logPlateEntries = useLogPlateEntries();
  const profileTimeZone = useProfileTimeZone({ enabled: useReadsEnabled() });
  const { items, time, canLog } = plate;
  const { startLogging, finishLogging, markLogged } = usePlateLoggingGuard();
  const day = context?.day;
  const { mutateAsync } = logPlateEntries;
  const timeZone = profileTimeZone.data === undefined ? undefined : (profileTimeZone.data ?? "UTC");

  const logPlate = useCallback(async (): Promise<LogPlateResult> => {
    if (!canLog || timeZone === undefined || !startLogging()) {
      return { ok: false, wasIgnored: true };
    }
    const zone = timeZone;

    // Writes the plate, and says when it was logged. Undefined means nothing was written.
    async function writePlate() {
      // "Now" is the moment Log foods is pressed. A past day takes the current clock time on that day.
      const opening = openingLoggedAt(new Date(), day === undefined ? undefined : { day }, zone);
      const { loggedAt, localDate } = time.isNow
        ? opening
        : clockTimeOn(opening.localDate, time.time, zone);
      await mutateAsync({ items, loggedAt: loggedAt.toISOString(), localDate });

      return { loggedAt, localDate };
    }

    // The failure is not kept: it can quote a food or an amount, which is health data.
    const written = await writePlate().catch(() => undefined);
    if (written === undefined) {
      finishLogging();

      return { ok: false };
    }

    // The plate is logged, so the log stays held: the sheet is closing and its provider goes with it, and
    // a second press in that time would log the plate again.
    toast.show({
      message: describeLoggedPlate(items.map(plateItemName)),
      tone: "success",
      icon: "Check",
    });
    const hour = parseClockTime(formatClockTime(written.loggedAt, zone))?.hour;
    // The sheet's guard lets a close through once the plate is logged, so the close waits for that render.
    markLogged(() => {
      closeSheet();
      router.push(diaryHref(written.localDate, hour));
    });

    return { ok: true };
  }, [
    canLog,
    timeZone,
    startLogging,
    finishLogging,
    markLogged,
    day,
    time,
    items,
    mutateAsync,
    toast,
    closeSheet,
    router,
  ]);

  return { logPlate };
}
