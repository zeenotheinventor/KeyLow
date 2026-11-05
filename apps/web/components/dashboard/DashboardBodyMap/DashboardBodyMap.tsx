import { useDashboardBodyMap } from "@keylow/api-client";

import { DashboardBodyMapCard } from "../DashboardBodyMapCard";
import { DashboardBodyMapLoading } from "../DashboardBodyMapLoading";
import { DashboardBodyMapMessage } from "../DashboardBodyMapMessage";

import { useBodyFigure } from "@/lib/bodyFigure";
import { useIsOnline } from "@/lib/useIsOnline";
import { useNow } from "@/lib/useNow";

/**
 * The body map card, once the dashboard is up: Actual heat now, the warmest three muscles and today's plan,
 * worked out by the hook from the rows at the time on the clock, so it cools as the day goes on. It loads
 * and fails on its own, so the cards above it are unaffected: a skeleton while it loads, and a quiet line
 * when a read failed. The web keeps no copy of the rows for offline use, so offline with nothing already
 * read there is nothing to wait for, and it says so rather than loading for ever. A refetch that fails
 * keeps the numbers already on screen, which the hook holds. The figure is drawn as the figure setting has
 * it, which the card waits for with the rows so it never draws the wrong one first.
 */
export function DashboardBodyMap() {
  const isOnline = useIsOnline();
  const bodyMap = useDashboardBodyMap({ now: useNow().toISOString() });
  const { figure, isReady: isFigureReady } = useBodyFigure();

  if (bodyMap.data !== undefined) {
    // The skeleton is only for the first draw, which must match the server's. The store is read at once in the browser.
    return isFigureReady ? (
      <DashboardBodyMapCard bodyMap={bodyMap.data} body={figure} />
    ) : (
      <DashboardBodyMapLoading />
    );
  }
  if (bodyMap.isError) {
    return <DashboardBodyMapMessage kind="failed" />;
  }
  return isOnline ? <DashboardBodyMapLoading /> : <DashboardBodyMapMessage kind="offline" />;
}
