import { useDiaryWeek, useTargets } from "@keylow/api-client";
import { weekDayTotals, weekOf, weekSummary } from "@keylow/core/diary";
import { useRouter } from "expo-router";

import { useIsOnline } from "../../../lib/connectivity";
import { ThisWeekCard } from "../ThisWeekCard";
import { ThisWeekLoading } from "../ThisWeekLoading";
import { ThisWeekMessage } from "../ThisWeekMessage";

import type { DashboardWeekProps } from "./types";

/**
 * The This week card, once today is known: the week that holds today (the same query the diary's week
 * strip reads, so the two share the cache and agree) and the targets, added up by core. The card sets the
 * week's average against the week's calories, so the targets are read with no date. It loads and
 * fails on its own, so the Today card above it is unaffected. The week is asked for by today's Monday, so
 * when the date rolls over into a new week the card reads that week and never sums the old one for the
 * new day. Its numbers are the totals as given: nothing here adds them up a second way. Pressing it opens
 * the weekly averages screen.
 */
export function DashboardWeek({ today, isReadEnabled }: DashboardWeekProps) {
  const router = useRouter();
  const isOnline = useIsOnline();
  const weekStart = weekOf(today)[0] ?? today;
  const weekQuery = useDiaryWeek(weekStart, { enabled: isReadEnabled });
  const targetsQuery = useTargets({ enabled: isReadEnabled });
  const week = weekQuery.data;
  const targets = targetsQuery.data;

  // A refetch that fails keeps what is cached on screen: only a read that never produced data is a failure.
  if (
    (weekQuery.isError && week === undefined) ||
    (targetsQuery.isError && targets === undefined)
  ) {
    return (
      <ThisWeekMessage
        kind="failed"
        weekStart={weekStart}
        onRetry={() => {
          void Promise.all([
            weekQuery.isError ? weekQuery.refetch() : undefined,
            targetsQuery.isError ? targetsQuery.refetch() : undefined,
          ]);
        }}
      />
    );
  }
  if (week === undefined || targets === undefined) {
    // Offline, a read that has not arrived will not: there is no saved week to show.
    return isOnline ? (
      <ThisWeekLoading />
    ) : (
      <ThisWeekMessage kind="offline" weekStart={weekStart} />
    );
  }

  return (
    <ThisWeekCard
      summary={weekSummary({
        days: week.map((day) => ({
          localDate: day.localDate,
          dayLog: day.dayLog,
          totals: weekDayTotals(day.totals),
        })),
        today,
        targetKcal: targets.kcal,
      })}
      onOpen={() => {
        router.push("/week");
      }}
    />
  );
}
