import { describeSessionBar } from "@keylow/core/copy";
import { sessionClock } from "@keylow/core/training";

import type { SessionClockProps } from "./types";

import { useNow } from "@/lib/useNow";

const CLOCK_TICK_MILLISECONDS = 1000;

/**
 * The session's name with, under it, the clock and the sets logged: "30:00 · 8 of 16 sets". It reads the
 * time itself and moves on every second, so the tick redraws this heading and nothing else on the page.
 * The time is never in a query key.
 */
export function SessionClock({
  dayName,
  startedAt,
  endedAt,
  setsLogged,
  setsPlanned,
}: SessionClockProps) {
  const now = useNow(CLOCK_TICK_MILLISECONDS);
  const bar = describeSessionBar({
    dayName,
    clockSeconds: sessionClock({ started_at: startedAt, ended_at: endedAt }, now.toISOString()),
    setsLogged,
    setsPlanned,
  });

  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <h1 className="text-h1">{bar.name}</h1>
      <p className="text-caption tabular-nums text-text-secondary">{bar.detail}</p>
    </div>
  );
}
