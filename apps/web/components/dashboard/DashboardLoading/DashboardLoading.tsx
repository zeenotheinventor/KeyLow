import { DASHBOARD_LOADING_NAME, OFFLINE_BANNER } from "@keylow/core/copy";
import { WifiOff } from "lucide-react";

import type { DashboardLoadingProps } from "./types";

import { Banner } from "@/components/ui/Banner";
import { Card } from "@/components/ui/Card";
import { Skeleton, SkeletonBone } from "@/components/ui/Skeleton";

const MACRO_ROWS = ["protein", "carbs", "fat"];

/**
 * What the dashboard shows while its card loads, as the loading board draws it: the card's shape in
 * bones, after the 200 ms the skeleton waits. The offline notice shows above it when the page opens
 * without a connection.
 */
export function DashboardLoading({ isOnline }: DashboardLoadingProps) {
  return (
    <>
      {isOnline ? null : (
        <Banner title={OFFLINE_BANNER.title} icon={WifiOff}>
          {OFFLINE_BANNER.body}
        </Banner>
      )}
      <Skeleton label={DASHBOARD_LOADING_NAME}>
        <Card padding="none" className="flex flex-col gap-4 p-4 sm:p-5">
          <SkeletonBone className="h-5 w-[72px]" />
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
            <span
              aria-hidden
              className="box-border size-[200px] shrink-0 rounded-full border-[14px] border-skeleton-base"
            />
            <div className="flex w-full min-w-0 flex-col gap-3 sm:w-auto sm:flex-1">
              {MACRO_ROWS.map((row) => (
                <span
                  key={row}
                  className="grid grid-cols-[72px_minmax(0,1fr)_96px] items-center gap-x-3"
                >
                  <SkeletonBone className="h-3 w-14" />
                  <SkeletonBone className="h-2 rounded-pill" />
                  <SkeletonBone className="h-3" />
                </span>
              ))}
            </div>
          </div>
          <SkeletonBone className="h-3 w-[140px]" />
        </Card>
      </Skeleton>
    </>
  );
}
