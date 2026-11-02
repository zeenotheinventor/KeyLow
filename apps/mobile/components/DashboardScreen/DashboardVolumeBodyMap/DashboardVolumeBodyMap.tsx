import {
  useBodyMap,
  useDashboardBodyMap,
  useProfileTimeZone,
  weekStartOf,
} from "@keylow/api-client";
import { toLocalDate } from "@keylow/core/dates";
import { useRouter } from "expo-router";

import { useBodyFigure } from "../../../lib/bodyFigure";
import { bodyMapPath } from "../../../lib/bodyMapRoutes";
import { useIsOnline } from "../../../lib/connectivity";
import { useNow } from "../../../lib/useNow";
import { DashboardBodyMapCard } from "../DashboardBodyMapCard";
import { DashboardBodyMapLoading } from "../DashboardBodyMapLoading";
import { DashboardBodyMapMessage } from "../DashboardBodyMapMessage";

import type { DashboardVolumeBodyMapProps } from "./types";

/**
 * The body map card in Weekly volume: this calendar week's Actual volume, Monday to Sunday in the profile's
 * zone, from the same cached rows as the body map screen through its own read, so the colours match the
 * screen on Volume Actual at the same moment and a set logged today moves its muscles' bands with no new
 * request. Today's plan still comes from the Heat card's read, so "Today: Legs" reads the same in both
 * charts. The card is shown once both reads are in, a skeleton while either loads, a quiet line when one
 * failed, and the offline line when offline with nothing cached. Pressing it opens the body map on Volume.
 */
export function DashboardVolumeBodyMap({ isReadEnabled }: DashboardVolumeBodyMapProps) {
  const router = useRouter();
  const isOnline = useIsOnline();
  const now = useNow();
  const nowIso = now.toISOString();
  const today = useDashboardBodyMap({ now: nowIso, enabled: isReadEnabled });
  const timeZone = useProfileTimeZone({ enabled: isReadEnabled });
  const zone = timeZone.data;
  const volume = useBodyMap({
    scale: "volume",
    view: "actual",
    weekStart: weekStartOf(toLocalDate(now, zone ?? "UTC")),
    now: nowIso,
    // The week it reads is the profile's, so it waits for the zone rather than read UTC's week first.
    enabled: isReadEnabled && zone !== undefined,
  });
  const { figure, isReady: isFigureReady } = useBodyFigure();

  if (volume.data !== undefined && today.data !== undefined) {
    // The card waits for the stored figure, which the phone gives at once, so it never draws the wrong one first.
    return isFigureReady ? (
      <DashboardBodyMapCard
        body={figure}
        bodyMap={{ values: volume.data.values, warmest: [], today: today.data.today }}
        scale="volume"
        onOpen={() => {
          router.push(bodyMapPath("dashboard", "volume"));
        }}
      />
    ) : (
      <DashboardBodyMapLoading />
    );
  }
  if (volume.isError || today.isError) {
    return <DashboardBodyMapMessage kind="failed" />;
  }
  return isOnline ? <DashboardBodyMapLoading /> : <DashboardBodyMapMessage kind="offline" />;
}
