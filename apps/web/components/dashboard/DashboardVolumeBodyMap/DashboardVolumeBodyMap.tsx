import {
  useBodyMap,
  useDashboardBodyMap,
  useProfileTimeZone,
  weekStartOf,
} from "@keylow/api-client";
import { toLocalDate } from "@keylow/core/dates";

import { DashboardBodyMapCard } from "../DashboardBodyMapCard";
import { DashboardBodyMapLoading } from "../DashboardBodyMapLoading";
import { DashboardBodyMapMessage } from "../DashboardBodyMapMessage";

import { useBodyFigure } from "@/lib/bodyFigure";
import { useIsOnline } from "@/lib/useIsOnline";
import { useNow } from "@/lib/useNow";

/**
 * The body map card in Weekly volume: this calendar week's Actual volume, Monday to Sunday in the profile's
 * zone, from the same rows as the body map page through its own read, so the colours match the page on
 * Volume Actual at the same moment. Today's plan comes from the Heat card's read, so "Today: Legs" reads
 * the same in both charts. The card is shown once both reads are in, a skeleton while either loads, a
 * quiet line when one failed, and the offline line when offline with nothing read, because the web keeps
 * no copy of the rows and a read that is paused offline never answers. The week is the profile's, so the
 * read waits for the zone rather than read UTC's week first, and a zone that cannot be read is a failure
 * and not a wait. Opening the card goes to the body map on Volume.
 */
export function DashboardVolumeBodyMap() {
  const isOnline = useIsOnline();
  const now = useNow();
  const nowIso = now.toISOString();
  const today = useDashboardBodyMap({ now: nowIso });
  const timeZone = useProfileTimeZone();
  const zone = timeZone.data;
  const volume = useBodyMap({
    scale: "volume",
    view: "actual",
    weekStart: weekStartOf(toLocalDate(now, zone ?? "UTC")),
    now: nowIso,
    enabled: zone !== undefined,
  });
  const { figure, isReady: isFigureReady } = useBodyFigure();

  if (volume.data !== undefined && today.data !== undefined) {
    // The skeleton is only for the first draw, which must match the server's. The store is read at once in the browser.
    return isFigureReady ? (
      <DashboardBodyMapCard
        body={figure}
        bodyMap={{ values: volume.data.values, warmest: [], today: today.data.today }}
        scale="volume"
      />
    ) : (
      <DashboardBodyMapLoading />
    );
  }
  if (volume.isError || today.isError || (timeZone.isError && zone === undefined)) {
    return <DashboardBodyMapMessage kind="failed" />;
  }
  return isOnline ? <DashboardBodyMapLoading /> : <DashboardBodyMapMessage kind="offline" />;
}
