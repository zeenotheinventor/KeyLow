import { useBodyTrend } from "@keylow/api-client";
import {
  BODY_COMPOSITION,
  BODY_COMPOSITION_CHART,
  WEIGHT_SCREEN,
  describeCompositionChartName,
  describeCompositionSource,
} from "@keylow/core/copy";
import { composeBodySplit } from "@keylow/core/weight";
import { useRouter } from "expo-router";
import { useMemo } from "react";
import { Text as NativeText, View } from "react-native";

import { useReadsEnabled } from "../../lib/useReadsEnabled";
import { BodyCompositionChart, prepareBodyCompositionChart } from "../BodyCompositionChart";
import { BodyCompositionPrompt } from "../BodyCompositionPrompt";
import { useBodyCompositionKind } from "../BodyCompositionSection";
import { Badge, Skeleton, SegmentedControl, Text } from "../ui";

import type { BodyCompositionViewProps } from "./types";

const OPEN_HEALTH_ACCESS = "/more/weight/health";
const OPEN_PERMISSION_FLOW = "/more/weight/health?add=body-composition";

const UNIT_OPTIONS = [
  { value: "kg", label: BODY_COMPOSITION_CHART.units.kg },
  { value: "pct", label: BODY_COMPOSITION_CHART.units.pct },
] as const;

/**
 * What sits in the place of the weight figure when the person picks Composition: the two line figure, a row
 * with the Settling badge and the kg / % switch, the line saying which reading the split was worked out
 * from, and the lean mass caption. When there is nothing to draw it is the prompt for the case instead.
 * The first match of these wins: not connected, or connected with neither kind allowed, is the `not-allowed`
 * prompt. Connected with no answer about access yet, or an allowed kind still loading, is the loading status.
 * A split worked out from either kind is the figure, even when only one kind is allowed or has readings. An
 * allowed kind that failed with nothing to show is the `error` prompt, and otherwise allowed with no
 * readings is `no-readings-yet`. The prompt for the kind that cannot be read stays in the section under the
 * card, so it is not drawn here. Data that is showing stays when it is read again, so a refresh never
 * brings the skeleton back. The view is read only and puts no value in a log.
 */
export function BodyCompositionView({
  connection,
  access,
  weightPoints,
  range,
  today,
  unit,
  onUnitChange,
}: BodyCompositionViewProps) {
  const router = useRouter();
  const isReadEnabled = useReadsEnabled();
  const isConnected = connection === "connected";
  const isBodyFatAllowed = isConnected && access?.bodyFat === true;
  const isLeanMassAllowed = isConnected && access?.leanMass === true;
  const bodyFat = useBodyCompositionKind("body_fat_pct", {
    isEnabled: isBodyFatAllowed && isReadEnabled,
    range,
    today,
  });
  const leanMass = useBodyCompositionKind("lean_mass_kg", {
    isEnabled: isLeanMassAllowed && isReadEnabled,
    range,
    today,
  });
  const bodyFatTrend = useBodyTrend("body_fat_pct", { enabled: isBodyFatAllowed && isReadEnabled });
  const leanMassTrend = useBodyTrend("lean_mass_kg", {
    enabled: isLeanMassAllowed && isReadEnabled,
  });

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

  const allowedKinds = [
    ...(isBodyFatAllowed ? [bodyFat] : []),
    ...(isLeanMassAllowed ? [leanMass] : []),
  ];
  const hasNoAllowedKind = access !== null && !access.bodyFat && !access.leanMass;

  if (!isConnected || hasNoAllowedKind) {
    return (
      <BodyCompositionPrompt
        action={BODY_COMPOSITION.notAllowed.action}
        text={BODY_COMPOSITION.notAllowed.text}
        title={BODY_COMPOSITION.notAllowed.title}
        variant="not-allowed"
        onAction={() => {
          router.push(isConnected ? OPEN_PERMISSION_FLOW : OPEN_HEALTH_ACCESS);
        }}
      />
    );
  }

  if (access === null || allowedKinds.some((kind) => kind.status === "loading")) {
    return (
      <View accessible aria-label={BODY_COMPOSITION.loadingLabel} aria-live="polite" role="status">
        <Skeleton variant="bodyComposition" />
      </View>
    );
  }

  if (split.driver !== null) {
    const latestFat = chart.bodyFat.latest;
    const latestLean = chart.leanMass.latest;
    const latest =
      latestFat === null || latestLean === null
        ? null
        : { fat: latestFat.value, lean: latestLean.value };

    return (
      <View className="gap-3">
        <BodyCompositionChart
          data={chart}
          isSettling={split.settling}
          name={describeCompositionChartName(range, unit, latest)}
        />
        <View className="flex-row items-center justify-between px-1">
          {split.settling ? <Badge tone="warning">{WEIGHT_SCREEN.settlingBadge}</Badge> : <View />}
          <View className="w-[112px]">
            <SegmentedControl
              label={BODY_COMPOSITION_CHART.unitGroupLabel}
              options={UNIT_OPTIONS}
              size="sm"
              value={unit}
              onChange={onUnitChange}
            />
          </View>
        </View>
        <View className="gap-1">
          <Text className="px-1" tone="secondary" variant="label-small">
            {describeCompositionSource(split.driver)}
          </Text>
          <NativeText className="px-1 text-caption font-normal tabular-nums text-text-muted">
            {BODY_COMPOSITION.caption}
          </NativeText>
        </View>
      </View>
    );
  }

  if (allowedKinds.some((kind) => kind.status === "error")) {
    return (
      <BodyCompositionPrompt
        retry={BODY_COMPOSITION.error.retry}
        text={BODY_COMPOSITION.error.body}
        title={BODY_COMPOSITION.error.title}
        variant="error"
        onRetry={() => {
          allowedKinds.forEach((kind) => {
            if (kind.status === "error") {
              kind.refetch();
            }
          });
        }}
      />
    );
  }

  return (
    <BodyCompositionPrompt
      text={BODY_COMPOSITION.noReadings.text}
      title={BODY_COMPOSITION.noReadings.title}
      variant="no-readings-yet"
    />
  );
}
