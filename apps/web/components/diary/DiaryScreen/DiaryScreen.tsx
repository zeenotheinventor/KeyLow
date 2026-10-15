"use client";

import { useProfileTimeZone } from "@keylow/api-client";
import { DIARY_LOAD_FAILED, DAY_STEPPER } from "@keylow/core/copy";

import { DiaryDay } from "../DiaryDay";
import { DiaryLoading } from "../DiaryLoading";

import type { DiaryScreenProps } from "./types";
import type { ReactNode } from "react";

import { ErrorState } from "@/components/ui/ErrorState";

function DiaryFrame({ children }: { children: ReactNode }) {
  return <div className="mx-auto flex w-full max-w-[1132px] flex-col gap-5">{children}</div>;
}

/**
 * The diary page: the hour-by-hour food log for a day. The dashboard layout has already sent anyone
 * who has not accepted the current Terms to the accept page, so every read here is behind the terms
 * gate. The profile's time zone is read first, because every day and hour of the diary is read in it.
 */
export function DiaryScreen({ date, view }: DiaryScreenProps) {
  const timeZone = useProfileTimeZone();

  if (timeZone.isError) {
    return (
      <DiaryFrame>
        <h1 className="text-h1">{DAY_STEPPER.today}</h1>
        <ErrorState
          title={DIARY_LOAD_FAILED.title}
          body={DIARY_LOAD_FAILED.body}
          retryLabel={DIARY_LOAD_FAILED.action}
          onRetry={() => {
            void timeZone.refetch();
          }}
          className="min-h-[480px] justify-center border-0 bg-transparent py-0"
        />
      </DiaryFrame>
    );
  }

  if (timeZone.data === undefined) {
    return (
      <DiaryFrame>
        <h1 className="text-h1">{DAY_STEPPER.today}</h1>
        <DiaryLoading includesWeek />
      </DiaryFrame>
    );
  }

  // A signed in user always has a profile row, which the database creates. If it is missing the day is UTC.
  return (
    <DiaryFrame>
      <DiaryDay date={date} timeZone={timeZone.data ?? "UTC"} view={view} />
    </DiaryFrame>
  );
}
