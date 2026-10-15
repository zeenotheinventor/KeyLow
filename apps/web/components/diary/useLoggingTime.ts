import { useProfileTimeZone } from "@keylow/api-client";
import { clockTimeOn, openingLoggedAt } from "@keylow/core/diary";
import { useState } from "react";

import type { AddFoodRequest } from "@/lib/foodLogActions";

export type LoggingTime = {
  /** The Time field's value, `HH:mm`. */
  time: string;
  /** The time is still the moment the dialog opened, so the Time field says Now. */
  isNow: boolean;
  /** Called with the `HH:mm` the person chose in the Time field. */
  chooseTime: (time: string) => void;
  /** The instant to log at, and the calendar day it falls on in the profile's zone. */
  resolve: () => { loggedAt: Date; localDate: string };
};

/**
 * The time a new entry is logged at, for the dialogs that add one: the hour an hour's plus asked for, or the
 * moment the dialog opened ("Now", which does not move while it is open), on the day on view, until the person
 * chooses another in the Time field. Everything is read in the profile's zone, as the diary reads its days
 * and hours. A signed in user always has a profile row, which the database creates. If it is missing the day is UTC.
 */
export function useLoggingTime(request: AddFoodRequest): LoggingTime {
  const timeZone = useProfileTimeZone().data ?? "UTC";
  const [openedAt] = useState(() => new Date());
  const [chosenTime, setChosenTime] = useState<string | undefined>(undefined);

  const opening = openingLoggedAt(
    openedAt,
    { day: request.date, ...(request.time === undefined ? {} : { time: request.time }) },
    timeZone,
  );

  return {
    time: chosenTime ?? opening.clockTime,
    isNow: chosenTime === undefined && request.time === undefined,
    chooseTime: setChosenTime,
    resolve: () =>
      chosenTime === undefined ? opening : clockTimeOn(opening.localDate, chosenTime, timeZone),
  };
}
