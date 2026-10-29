"use client";

import { useProfileTimeZone } from "@keylow/api-client";
import { DASHBOARD_LOAD_FAILED, WEEK_AVERAGES } from "@keylow/core/copy";
import { toLocalDate } from "@keylow/core/dates";
import Link from "next/link";

import { WeekAverages } from "../WeekAverages";

import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useNow } from "@/lib/useNow";

function WeekAveragesForZone({ timeZone }: { timeZone: string }) {
  return <WeekAverages today={toLocalDate(useNow(), timeZone)} />;
}

/**
 * The weekly averages page, which the dashboard's This week card opens: the breadcrumb back to the
 * Dashboard and the heading, then the week's averages once the profile's time zone says which day today
 * is, and so which week. The dashboard layout has already put the Terms gate in front of it.
 */
export function WeekAveragesScreen() {
  const timeZone = useProfileTimeZone();

  function renderBody() {
    // A refetch that fails keeps the zone it already has: only a read that never produced one is a failure.
    if (timeZone.isError && timeZone.data === undefined) {
      return (
        <ErrorState
          title={DASHBOARD_LOAD_FAILED.title}
          body={DASHBOARD_LOAD_FAILED.body}
          retryLabel={DASHBOARD_LOAD_FAILED.action}
          onRetry={() => {
            void timeZone.refetch();
          }}
        />
      );
    }
    if (timeZone.data === undefined) {
      return <Skeleton variant="block" />;
    }

    // A signed in user always has a profile row, which the database creates. If it is missing the day is UTC.
    return <WeekAveragesForZone timeZone={timeZone.data ?? "UTC"} />;
  }

  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col gap-4">
      <div>
        <nav aria-label="Breadcrumb" className="text-caption">
          <Link href="/dashboard" className="rounded-small text-text-primary no-underline">
            {WEEK_AVERAGES.dashboard}
          </Link>
          <span className="text-text-muted"> / {WEEK_AVERAGES.title}</span>
        </nav>
        <h1 className="mt-1 text-h1">{WEEK_AVERAGES.title}</h1>
      </div>
      {renderBody()}
    </div>
  );
}
