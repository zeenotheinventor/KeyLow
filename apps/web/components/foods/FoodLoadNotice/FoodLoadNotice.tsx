import { FOOD_DETAIL, FOOD_NOT_FOUND, FOOD_NOT_LOADED } from "@keylow/core/copy";
import { SearchX } from "lucide-react";

import type { FoodLoadNoticeProps } from "./types";

import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton, SkeletonBone } from "@/components/ui/Skeleton";

/** What stands in for a food that is loading, missing or failed to load. The text of a failure is never shown. */
export function FoodLoadNotice({ state }: FoodLoadNoticeProps) {
  switch (state.status) {
    case "loading":
      return (
        <div className="mx-auto w-full max-w-2xl">
          <Skeleton label={FOOD_DETAIL.loading} className="flex flex-col gap-4">
            <SkeletonBone className="h-7 w-[70%]" />
            <SkeletonBone className="h-5 w-[120px] rounded-pill" />
            <SkeletonBone className="h-[140px] rounded-large" />
            <SkeletonBone className="h-[220px] rounded-large" />
            <p className="text-caption text-text-muted">{FOOD_DETAIL.loading}</p>
          </Skeleton>
        </div>
      );
    case "error":
      return (
        <div className="mx-auto w-full max-w-2xl">
          <ErrorState
            headingLevel={1}
            size="page"
            title={FOOD_NOT_LOADED.title}
            body={FOOD_NOT_LOADED.body}
          />
        </div>
      );
    case "notFound":
      return (
        <div className="mx-auto w-full max-w-2xl">
          <EmptyState
            icon={SearchX}
            headingLevel={1}
            size="page"
            title={FOOD_NOT_FOUND.title}
            body={FOOD_NOT_FOUND.body}
          />
        </div>
      );
  }
}
