import { describeSessionBar } from "@keylow/core/copy";
import { sessionClock } from "@keylow/core/training";
import { iconStroke } from "@keylow/tokens";
import { ChevronRight } from "lucide-react";
import Link from "next/link";

import type { SessionBarLinkProps } from "./types";

import { trainSessionPath } from "@/lib/trainRoutes";
import { useNow } from "@/lib/useNow";

const CLOCK_TICK_MILLISECONDS = 1000;

/**
 * The bar under the top bar while a session runs: an accent dot, the day's name, the clock with the sets and
 * a chevron, all one link to the session. It reads the time itself and moves on every second, so the tick
 * redraws this link and nothing else. Its accessible name carries whole minutes, so it changes once a minute
 * and a screen reader is not read every second. At the large width the numbers follow the name and the
 * chevron sits alone at the far end. Below it the name fills and the numbers sit at the end, as on the phone.
 * The frame makes it sticky, under the menu panel (z-10).
 */
export function SessionBarLink({
  dayName,
  startedAt,
  setsLogged,
  setsPlanned,
}: SessionBarLinkProps) {
  const now = useNow(CLOCK_TICK_MILLISECONDS);
  const copy = describeSessionBar({
    dayName,
    clockSeconds: sessionClock({ started_at: startedAt, ended_at: null }, now.toISOString()),
    setsLogged,
    setsPlanned,
  });

  return (
    <Link
      href={trainSessionPath()}
      aria-label={copy.accessibleName}
      className="flex h-control-lg items-center gap-3 border-b border-border bg-surface-sheet px-4 text-text-primary no-underline outline-none transition-colors duration-quick hover:bg-hover-overlay focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus-ring active:bg-press-overlay lg:px-8"
    >
      <span aria-hidden className="size-2 shrink-0 rounded-pill bg-accent" />
      <span className="min-w-0 truncate text-body-strong max-lg:flex-1">{copy.name}</span>
      <span className="shrink-0 text-caption tabular-nums text-text-secondary">{copy.detail}</span>
      <ChevronRight
        aria-hidden
        strokeWidth={iconStroke}
        className="size-[18px] shrink-0 text-text-muted lg:ml-auto"
      />
    </Link>
  );
}
