"use client";

import { useProfileTimeZone, useWeighIns, useWeightTrend } from "@keylow/api-client";
import { WEIGHT_EMPTY, WEIGHT_ERROR, WEIGHT_SCREEN } from "@keylow/core/copy";
import { toLocalDate } from "@keylow/core/dates";
import { Plus, Weight } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { WeighInDialog } from "../WeighInDialog";
import { WeightHeader } from "../WeightHeader";
import { WeightList } from "../WeightList";
import { WeightTrendCard } from "../WeightTrendCard";

import type { WeighIn } from "@keylow/api-client";

import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton, SkeletonBone } from "@/components/ui/Skeleton";
import { useIsOnline } from "@/lib/useIsOnline";
import { useNow } from "@/lib/useNow";

// The page's two columns: the trend card, the range control and the chart on the left, the weigh-ins on the
// right from the large breakpoint, and one column under it. The loaded page and its skeleton share them.
const COLUMNS_CLASS_NAME = "grid gap-4 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start lg:gap-6";

/**
 * What the loading board draws, as the board sizes it as drawn, its 1 px borders included: the trend card,
 * the range control and the chart on the left, and the Weigh-ins heading and its card on the right.
 */
function WeightLoading() {
  return (
    <Skeleton label={WEIGHT_SCREEN.loadingLabel} className={COLUMNS_CLASS_NAME}>
      <div className="flex flex-col gap-4">
        <SkeletonBone className="h-[114px] rounded-large" />
        <SkeletonBone className="h-[46px] rounded-medium" />
        <SkeletonBone className="h-[234px] rounded-large lg:h-[282px]" />
      </div>
      <div className="flex flex-col gap-3">
        <SkeletonBone className="h-5 w-[122px]" />
        <SkeletonBone className="h-[338px] rounded-large" />
      </div>
    </Skeleton>
  );
}

/**
 * The Weight page: the header over the list of the signed in user's weigh-ins, or the loading, error or
 * empty board, as the `web-weight` boards draw them. A failed refetch keeps the list, so only a list that
 * never loaded is the error board. Weigh-ins are health data and are not in the offline cache. The days are
 * named in the profile's zone, which the list waits for so "Today" does not flip when it arrives. A profile
 * with no zone, or a zone that cannot be read, reads as UTC, as the other pages read it, and so does a zone
 * that has not arrived while the connection is down, since a read cannot arrive then. Offline with nothing
 * read, a weigh-in list that never loaded is the error board with no Try again, which would do nothing:
 * the read goes ahead by itself when the connection returns.
 *
 * The trend card and the chart are the page's first column and the list is its second, beside it from the
 * large breakpoint and under it before. Add weigh-in, in the header and on the
 * empty board, and a row of the list open the weigh-in dialog, which this screen holds open or closed. It is
 * not a route, so the page behind it keeps its place.
 */
export function WeightScreen() {
  const weighIns = useWeighIns();
  const trend = useWeightTrend();
  const timeZone = useProfileTimeZone();
  const now = useNow();
  const isOnline = useIsOnline();
  // The weigh-in the dialog is open on, or `undefined` for a new one. Closed is `null`.
  const [openWeighIn, setOpenWeighIn] = useState<{ weighIn: WeighIn | undefined } | null>(null);
  const addButton = useRef<HTMLButtonElement>(null);
  const wasDialogOpen = useRef(false);

  // The dialog gives focus back to the control that opened it. When that control is gone, a deleted row or
  // the empty state's button once the first weigh-in is added, focus would be lost, so it goes to Add weigh-in.
  useEffect(() => {
    if (openWeighIn === null && wasDialogOpen.current) {
      if (document.activeElement === null || document.activeElement === document.body) {
        addButton.current?.focus();
      }
    }
    wasDialogOpen.current = openWeighIn !== null;
  }, [openWeighIn]);

  function addWeighIn() {
    setOpenWeighIn({ weighIn: undefined });
  }

  function renderBody() {
    if (weighIns.data?.length === 0) {
      return (
        <EmptyState
          icon={Weight}
          title={WEIGHT_EMPTY.title}
          body={WEIGHT_EMPTY.bodyWeb}
          size="page"
          action={{
            label: WEIGHT_EMPTY.addWeighIn,
            icon: Plus,
            variant: "primary",
            onClick: addWeighIn,
          }}
        />
      );
    }
    if (weighIns.data !== undefined && (!timeZone.isPending || !isOnline)) {
      const today = toLocalDate(now, timeZone.data ?? "UTC");

      return (
        <div className={COLUMNS_CLASS_NAME}>
          <WeightTrendCard weighIns={weighIns.data} trend={trend} today={today} />
          <WeightList
            weighIns={weighIns.data}
            today={today}
            isLeftOut={(localDate) => trend.byDate.get(localDate)?.rejected === true}
            onOpen={(weighIn) => {
              setOpenWeighIn({ weighIn });
            }}
          />
        </div>
      );
    }
    if (weighIns.isError) {
      return (
        <ErrorState
          title={WEIGHT_ERROR.title}
          body={WEIGHT_ERROR.body}
          retryLabel={WEIGHT_ERROR.retry}
          size="page"
          onRetry={() => {
            void weighIns.refetch();
          }}
        />
      );
    }
    if (!isOnline && weighIns.data === undefined) {
      return <ErrorState title={WEIGHT_ERROR.title} body={WEIGHT_ERROR.body} size="page" />;
    }
    return <WeightLoading />;
  }

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-4 lg:gap-6">
      <WeightHeader onAdd={addWeighIn} addButtonRef={addButton} />
      {renderBody()}
      {openWeighIn !== null && (
        <WeighInDialog
          key={openWeighIn.weighIn?.id ?? "new"}
          weighIn={openWeighIn.weighIn}
          onClose={() => {
            setOpenWeighIn(null);
          }}
        />
      )}
    </div>
  );
}
