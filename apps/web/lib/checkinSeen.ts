import { useEffect, useState, useSyncExternalStore } from "react";

import { readLocalPreferenceState, writeLocalPreference } from "@/lib/localPreference";

/** The key the phone keeps the same date under, on its own device. */
export const CHECKIN_SEEN_KEY = "program.checkinSeen";

const isDate = (stored: string): stored is string => /^\d{4}-\d{2}-\d{2}$/.test(stored);

type SeenState =
  | { status: "reading" }
  // The browser's storage cannot be read, so nothing is shown from a guess.
  | { status: "unreadable" }
  // The date this browser had stored when the page opened. It is not updated when the date is written.
  | { status: "read"; seenDate: string | null };

const NOT_YET_READ: SeenState = { status: "reading" };

function readSeenState(): SeenState {
  const state = readLocalPreferenceState(CHECKIN_SEEN_KEY, isDate);
  switch (state.status) {
    case "saved":
      return { status: "read", seenDate: state.value };
    case "empty":
      return { status: "read", seenDate: null };
    case "unreadable":
      return { status: "unreadable" };
  }
}

const subscribeToNothing = () => () => undefined;
const getServerSnapshot = () => NOT_YET_READ;

/**
 * Whether the check-in dated `checkinDate` has just arrived in this browser: the Programme page has not yet shown
 * its motion for it. It is new when the date this browser had stored on opening is not the check-in's, and the
 * check-in's date is stored at once, so the next open finds it seen. It stays new for the rest of the visit,
 * because the date read on opening is the one it is compared with. Nothing is new until the date has been read,
 * while there is no check-in, or when storage cannot be read. Only a date is stored, which is not health data.
 *
 * The server has no storage, so its snapshot, and the browser's first draw that hydrates it, is "not yet read" and so
 * not new, and the stored date follows at once. The motion is therefore never played from a guess. The date is read once for each page, in the snapshot, because a read in
 * render is only safe when it is behind a server snapshot, as the weight chart's view is.
 */
export function useCheckinArrival(checkinDate: string | null): { isNew: boolean } {
  const [getSnapshot] = useState(() => {
    let opening: SeenState | undefined;
    return () => (opening ??= readSeenState());
  });
  const state = useSyncExternalStore(subscribeToNothing, getSnapshot, getServerSnapshot);

  const arrivingDate =
    state.status === "read" && checkinDate !== null && state.seenDate !== checkinDate
      ? checkinDate
      : null;

  useEffect(() => {
    if (arrivingDate !== null) {
      writeLocalPreference(CHECKIN_SEEN_KEY, arrivingDate);
    }
  }, [arrivingDate]);

  return { isNew: arrivingDate !== null };
}
