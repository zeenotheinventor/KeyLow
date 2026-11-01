import { useDashboardBodyMap } from "@keylow/api-client";

import { DashboardBodyMapCard } from "../DashboardBodyMapCard";
import { DashboardBodyMapLoading } from "../DashboardBodyMapLoading";
import { DashboardBodyMapMessage } from "../DashboardBodyMapMessage";

import { useDashboardBodyScale } from "@/lib/useDashboardBodyScale";
import { useIsOnline } from "@/lib/useIsOnline";
import { useNow } from "@/lib/useNow";

/**
 * The body map card, once the dashboard is up: the chart the Dashboard chart setting picks (Actual heat now
 * with the warmest three muscles, or the week's actual sets with the most trained three) and today's plan,
 * worked out by the hook from the rows at the time on the clock, so it cools as the day goes on. It loads
 * and fails on its own, so the cards above it are unaffected: a skeleton while it loads, and a quiet line
 * when a read failed. The web keeps no copy of the rows for offline use, so offline with nothing already
 * read there is nothing to wait for, and it says so rather than loading for ever. A refetch that fails
 * keeps the numbers already on screen, which the hook holds. The setting is kept in the browser, so the
 * server and the first draw cannot know it, and the card shows the skeleton until it is read rather than
 * draw the wrong chart first. The figure is the male one, until the figure setting reaches the web.
 */
export function DashboardBodyMap() {
  const isOnline = useIsOnline();
  const { scale, isRead } = useDashboardBodyScale();
  const bodyMap = useDashboardBodyMap({ now: useNow().toISOString(), scale });

  if (!isRead) {
    return <DashboardBodyMapLoading />;
  }
  if (bodyMap.data !== undefined) {
    return <DashboardBodyMapCard bodyMap={bodyMap.data} />;
  }
  if (bodyMap.isError) {
    return <DashboardBodyMapMessage kind="failed" />;
  }
  return isOnline ? <DashboardBodyMapLoading /> : <DashboardBodyMapMessage kind="offline" />;
}
