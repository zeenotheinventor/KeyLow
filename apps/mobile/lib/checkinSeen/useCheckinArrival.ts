import { useEffect, useState } from "react";

import { readCheckinSeenDate, writeCheckinSeenDate } from "./checkinSeenStore";

type SeenState =
  | { status: "reading" }
  // The store could not be read, so nothing is shown from a guess.
  | { status: "unreadable" }
  // The date the device had stored when the screen opened. It is not updated when the date is written.
  | { status: "read"; seenDate: string | null };

/**
 * Whether the check-in dated `checkinDate` has just arrived on this device: the Programme screen has not yet
 * shown its motion for it. It is new when the date the device had stored on opening is not that of the check-in,
 * and the check-in's date is stored at once, so the next open finds it seen. It stays new for the rest of the
 * visit, because the date read on opening is the one it is compared with, so a card that mounts late still
 * arrives. Nothing is new until the store has been read, while the date is null, or when the store cannot be
 * read. Only the date is stored. It is not health data.
 */
export function useCheckinArrival(checkinDate: string | null): { isRead: boolean; isNew: boolean } {
  const [state, setState] = useState<SeenState>({ status: "reading" });

  useEffect(() => {
    let isCancelled = false;
    readCheckinSeenDate().then(
      (seenDate) => {
        if (!isCancelled) {
          setState({ status: "read", seenDate });
        }
      },
      () => {
        if (!isCancelled) {
          setState({ status: "unreadable" });
        }
      },
    );

    return () => {
      isCancelled = true;
    };
  }, []);

  const isNew = state.status === "read" && checkinDate !== null && state.seenDate !== checkinDate;

  useEffect(() => {
    if (isNew) {
      void writeCheckinSeenDate(checkinDate);
    }
  }, [isNew, checkinDate]);

  return { isRead: state.status !== "reading", isNew };
}
