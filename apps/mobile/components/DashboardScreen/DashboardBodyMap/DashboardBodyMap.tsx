import { useDashboardBodyMap } from "@keylow/api-client";
import { useRouter } from "expo-router";

import { useBodyFigure } from "../../../lib/bodyFigure";
import { bodyMapPath } from "../../../lib/bodyMapRoutes";
import { useIsOnline } from "../../../lib/connectivity";
import { useDashboardBodyScale } from "../../../lib/dashboardBodyScale";
import { useNow } from "../../../lib/useNow";
import { DashboardBodyMapCard } from "../DashboardBodyMapCard";
import { DashboardBodyMapLoading } from "../DashboardBodyMapLoading";
import { DashboardBodyMapMessage } from "../DashboardBodyMapMessage";

import type { DashboardBodyMapProps } from "./types";

/**
 * The body map card, once the Dashboard is up: the chart the Dashboard chart setting picks (Actual heat now
 * with the warmest three muscles, or the week's actual sets with the most trained three) and today's plan,
 * worked out by the hook from the cached rows at the time on the clock, so it shows offline and cools as
 * the day goes on. It loads and fails on its own, so the cards above it are unaffected: a skeleton while
 * it loads, and a quiet line when a read failed. Offline with no rows saved there is nothing to wait for,
 * so it says so rather than loading for ever. A refetch that fails keeps the numbers already on screen,
 * which the hook holds. The figure is the one the figure setting has, and the card waits for it and for
 * the chart setting. Pressing the card opens the body map screen.
 */
export function DashboardBodyMap({ isReadEnabled }: DashboardBodyMapProps) {
  const router = useRouter();
  const isOnline = useIsOnline();
  const { scale, isReady: isScaleReady } = useDashboardBodyScale();
  const bodyMap = useDashboardBodyMap({
    now: useNow().toISOString(),
    scale,
    enabled: isReadEnabled,
  });
  const { figure, isReady: isFigureReady } = useBodyFigure();

  if (bodyMap.data !== undefined) {
    // The card waits for the stored figure and chart, which the phone gives at once, so it never draws the
    // wrong one first.
    return isFigureReady && isScaleReady ? (
      <DashboardBodyMapCard
        body={figure}
        bodyMap={bodyMap.data}
        onOpen={() => {
          router.push(bodyMapPath());
        }}
      />
    ) : (
      <DashboardBodyMapLoading />
    );
  }
  if (bodyMap.isError) {
    return <DashboardBodyMapMessage kind="failed" />;
  }
  return isOnline ? <DashboardBodyMapLoading /> : <DashboardBodyMapMessage kind="offline" />;
}
