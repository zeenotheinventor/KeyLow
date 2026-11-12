"use client";

import { useExpenditureChart } from "@keylow/api-client";
import { PROGRAM_CHART, PROGRAM_ERROR } from "@keylow/core/copy";
import { ChartLine } from "lucide-react";

import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { LineChart } from "@/components/ui/LineChart";
import { Skeleton, SkeletonBone } from "@/components/ui/Skeleton";
import { useIsOnline } from "@/lib/useIsOnline";
import { useNow } from "@/lib/useNow";

/**
 * The expenditure estimate week by week with its likely range, as the `program-default` board draws it under
 * the check-in: the line chart with its band and legend, named by the sentence written under it. With no
 * estimate yet the card keeps its label over the empty state (`program-chart-empty`), and a history that
 * cannot be read is an error card in its place (`program-chart-error`), so the rest of the page stands.
 *
 * While the history is being read the card holds its place with a bone of the chart's size, as the page's
 * own skeleton does, so the page does not grow when the chart arrives. The web has no persisted cache and a
 * read pauses offline, so a history that has not been read stays pending, and offline that is the error card
 * without Try again, which would do nothing: the read goes ahead by itself when the connection returns. Weeks
 * already read stay on show.
 */
export function ExpenditureChartCard() {
  const state = useExpenditureChart({ enabled: true, now: useNow() });
  const isOnline = useIsOnline();

  switch (state.status) {
    case "pending":
      return isOnline ? (
        <Skeleton>
          <SkeletonBone className="h-[300px] rounded-large" />
        </Skeleton>
      ) : (
        <ErrorState title={PROGRAM_ERROR.title} body={PROGRAM_ERROR.body} />
      );
    case "error":
      return (
        <ErrorState
          title={PROGRAM_ERROR.title}
          body={PROGRAM_ERROR.body}
          retryLabel={PROGRAM_ERROR.retryLabel}
          {...(isOnline ? { onRetry: state.retry } : {})}
        />
      );
    case "empty":
      return (
        <div className="flex flex-col gap-2">
          <p className="px-1 text-caption text-text-secondary">{PROGRAM_CHART.label}</p>
          <EmptyState
            icon={ChartLine}
            title={PROGRAM_CHART.empty.title}
            body={PROGRAM_CHART.empty.body}
            size="list"
          />
        </div>
      );
    case "chart":
      return (
        <LineChart
          points={state.view.points}
          band={state.view.band}
          legend={state.view.legend}
          label={state.view.label}
          unit={state.view.unit}
          summary={state.view.summary}
          formatValue={state.view.formatValue}
        />
      );
  }
}
