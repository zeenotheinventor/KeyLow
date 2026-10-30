import { useDashboardBodyMap } from "@keylow/api-client";

import { DashboardBodyMapCard } from "../DashboardBodyMapCard";
import { DashboardBodyMapLoading } from "../DashboardBodyMapLoading";
import { DashboardBodyMapMessage } from "../DashboardBodyMapMessage";

import { useIsOnline } from "@/lib/useIsOnline";
import { useNow } from "@/lib/useNow";

/**
 * The body map card, once the dashboard is up: Actual heat now, the warmest three muscles and today's plan,
 * worked out by the hook from the rows at the time on the clock, so it cools as the day goes on. It loads
 * and fails on its own, so the cards above it are unaffected: a skeleton while it loads, and a quiet line
 * when a read failed. The web keeps no copy of the rows for offline use, so offline with nothing already
 * read there is nothing to wait for, and it says so rather than loading for ever. A refetch that fails
 * keeps the numbers already on screen, which the hook holds. The figure is the male one, until the
 * figure setting reaches the web.
 */
export function DashboardBodyMap() {
  const isOnline = useIsOnline();
  const bodyMap = useDashboardBodyMap({ now: useNow().toISOString() });

  if (bodyMap.data !== undefined) {
    return <DashboardBodyMapCard bodyMap={bodyMap.data} />;
  }
  if (bodyMap.isError) {
    return <DashboardBodyMapMessage kind="failed" />;
  }
  return isOnline ? <DashboardBodyMapLoading /> : <DashboardBodyMapMessage kind="offline" />;
}
