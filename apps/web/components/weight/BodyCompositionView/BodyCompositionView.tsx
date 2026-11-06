import { useBodyCompositionKind, useBodyTrend } from "@keylow/api-client";
import {
  BODY_COMPOSITION,
  BODY_COMPOSITION_CHART,
  WEIGHT_SCREEN,
  describeCompositionChartName,
  describeCompositionSource,
} from "@keylow/core/copy";
import {
  bodyCompositionViewStage,
  composeBodySplit,
  prepareBodyCompositionChart,
} from "@keylow/core/weight";
import { useMemo } from "react";

import { BodyCompositionChart } from "../BodyCompositionChart";

import type { BodyCompositionViewProps } from "./types";

import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/ErrorState";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Skeleton, SkeletonBone } from "@/components/ui/Skeleton";
import { useIsOnline } from "@/lib/useIsOnline";

const UNIT_OPTIONS = [
  { value: "kg", label: BODY_COMPOSITION_CHART.units.kg },
  { value: "pct", label: BODY_COMPOSITION_CHART.units.pct },
] as const;

/**
 * What sits in the place of the weight figure when the person picks Composition, as the `web-weight,
 * body-composition-view-*` boards draw it: the two line figure, a row with the Settling badge and the kg / %
 * switch, the line saying which reading the split was worked out from, and the lean mass caption. When there
 * is nothing to draw it is one quiet line, one shape or the error state in the figure's place.
 *
 * The web has no Health Connect, so both kinds read as allowed. The first match of these wins. A split worked
 * out from either kind is the figure, though while a kind is still loading online the view waits, so the lines
 * do not change from lean mass to body fat when the other kind arrives. A kind still loading is one shape of
 * the figure's size. Offline a read pauses and never finishes, so a paused kind is not waited for: with a
 * split to draw it is the figure, and with none it is the error state with no Try again, since the read goes
 * ahead by itself when the connection returns. A kind that failed with nothing to show is the error state
 * with Try again, and otherwise there are no readings. Data that is showing stays when it is read again, so a
 * refresh never brings the shape back. The view is read only and puts no value in a log.
 */
export function BodyCompositionView({
  weightPoints,
  range,
  today,
  unit,
  onUnitChange,
}: BodyCompositionViewProps) {
  const isOnline = useIsOnline();
  const bodyFat = useBodyCompositionKind("body_fat_pct", { range, today });
  const leanMass = useBodyCompositionKind("lean_mass_kg", { range, today });
  const bodyFatTrend = useBodyTrend("body_fat_pct");
  const leanMassTrend = useBodyTrend("lean_mass_kg");

  const split = useMemo(
    () =>
      composeBodySplit({
        weight: weightPoints,
        bodyFat: bodyFatTrend.points,
        leanMass: leanMassTrend.points,
        unit,
      }),
    [weightPoints, bodyFatTrend.points, leanMassTrend.points, unit],
  );
  const chart = useMemo(
    () => prepareBodyCompositionChart({ points: split.points, range, today }),
    [split.points, range, today],
  );

  const kinds = [bodyFat, leanMass];
  const stage = bodyCompositionViewStage({
    statuses: kinds.map((kind) => kind.status),
    hasSplit: split.driver !== null,
    isOnline,
  });

  if (stage === "drawing" && split.driver !== null) {
    const latestFat = chart.bodyFat.latest;
    const latestLean = chart.leanMass.latest;
    const latest =
      latestFat === null || latestLean === null
        ? null
        : { fat: latestFat.value, lean: latestLean.value };

    return (
      <div className="flex flex-col gap-3">
        <BodyCompositionChart
          data={chart}
          isSettling={split.settling}
          name={describeCompositionChartName(range, unit, latest)}
        />
        <div className="flex items-center justify-between px-1">
          {split.settling ? <Badge tone="warning">{WEIGHT_SCREEN.settlingBadge}</Badge> : <span />}
          <div className="w-[112px]">
            <SegmentedControl
              label={BODY_COMPOSITION_CHART.unitGroupLabel}
              options={UNIT_OPTIONS}
              size="sm"
              value={unit}
              onChange={onUnitChange}
            />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          {/* The board draws the line in the label size at the regular weight, which no type class has. */}
          <p className="px-1 text-[14px] font-normal leading-5 tabular-nums text-text-secondary">
            {describeCompositionSource(split.driver)}
          </p>
          <p className="px-1 text-caption tabular-nums text-text-muted">
            {BODY_COMPOSITION.caption}
          </p>
        </div>
      </div>
    );
  }

  if (stage === "paused") {
    return (
      <ErrorState
        title={BODY_COMPOSITION.error.title}
        body={BODY_COMPOSITION.error.body}
        size="list"
      />
    );
  }

  if (stage === "loading") {
    // The figure's box: 12 of padding, the drawing and the labels, and the 1 px borders.
    return (
      <Skeleton label={BODY_COMPOSITION.loadingLabel}>
        <SkeletonBone className="h-[204px] rounded-large lg:h-[264px]" />
      </Skeleton>
    );
  }

  if (stage === "error") {
    return (
      <ErrorState
        title={BODY_COMPOSITION.error.title}
        body={BODY_COMPOSITION.error.body}
        retryLabel={BODY_COMPOSITION.error.retry}
        size="list"
        onRetry={() => {
          kinds.forEach((kind) => {
            if (kind.status === "error") {
              kind.refetch();
            }
          });
        }}
      />
    );
  }

  return (
    <Card>
      {/* The board draws the line in the label size at the regular weight, which no type class has. */}
      <p className="text-[14px] font-normal leading-5 text-text-secondary">
        {BODY_COMPOSITION.noReadingsWeb}
      </p>
    </Card>
  );
}
