import { SESSION_ACTIVE, describeSessionBar } from "@keylow/core/copy";
import { sessionClock } from "@keylow/core/training";

import { useNow } from "../../lib/useNow";
import { SheetHeader } from "../ui";

import type { SessionClockProps } from "./types";

const CLOCK_TICK_MILLISECONDS = 1000;

/**
 * The header of the session in progress: the control that hides it, the session's name and, under it, the
 * clock with the sets logged. It reads the time itself and moves on every second, so the one-second tick
 * redraws this header and nothing else on the screen. The time is never in a query key.
 */
export function SessionClock({
  dayName,
  startedAt,
  endedAt,
  setsLogged,
  setsPlanned,
  onHide,
  trailingSlot,
}: SessionClockProps) {
  const now = useNow(CLOCK_TICK_MILLISECONDS);
  const bar = describeSessionBar({
    dayName,
    clockSeconds: sessionClock({ started_at: startedAt, ended_at: endedAt }, now.toISOString()),
    setsLogged,
    setsPlanned,
  });

  return (
    <SheetHeader
      leading={{ icon: "ChevronDown", label: SESSION_ACTIVE.hideSessionName, onPress: onHide }}
      subtitle={bar.detail}
      title={bar.name}
      trailingSlot={trailingSlot}
    />
  );
}
