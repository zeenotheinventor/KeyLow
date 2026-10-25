import {
  BODY_COMPOSITION,
  WEIGHT_SCREEN,
  describeBodyChange,
  describeBodyChartName,
  describeBodyRangeEmpty,
  describeBodySettlingLine,
  describeBodyValue,
} from "@keylow/core/copy";
import { Text as NativeText, View } from "react-native";

import { Badge, Card, Sparkline, Text } from "../ui";

import type { BodyCompositionCardProps } from "./types";

/**
 * One labelled value of the Weight screen's Body composition section, full width: the label and one badge
 * on the first row, the trend to one decimal with its unit and the 128 by 40 trend line, and under them
 * the reason when there is no change to show. A settled trend with a change has the change badge and the
 * line. A trend that is still settling has the "Settling" badge, the count so far and the line when the
 * range holds a point of it, with no change badge. A range with fewer than two readings has the reason,
 * with no badge and no line.
 */
export function BodyCompositionCard(props: BodyCompositionCardProps) {
  const { kind, trend, range } = props;
  const { label } = BODY_COMPOSITION.kinds[kind];
  const { valueText, unit } = describeBodyValue(kind, trend);

  return (
    <Card aria-label={label}>
      <View className="gap-1">
        <View className="flex-row items-center justify-between gap-2">
          <Text className="uppercase tracking-[0.04em]" tone="secondary" variant="caption">
            {label}
          </Text>
          {props.state === "settling" ? (
            <Badge tone="warning">{WEIGHT_SCREEN.settlingBadge}</Badge>
          ) : null}
          {props.state === "chart" ? (
            <Badge tone="accent">{describeBodyChange(kind, props.change, range)}</Badge>
          ) : null}
        </View>
        <View className="flex-row items-end justify-between gap-3">
          <View className="flex-row items-baseline gap-1">
            {/* The design sets the value at 32 over 38, which is between the type scale's sizes, as the trend weight is. */}
            <NativeText className="text-[32px] font-semibold leading-[38px] tracking-[-0.02em] tabular-nums text-text-primary">
              {valueText}
            </NativeText>
            <Text tone="secondary">{unit}</Text>
          </View>
          {(props.state === "chart" || props.state === "settling") && props.line !== null ? (
            <Sparkline
              label={describeBodyChartName(kind, range, trend)}
              points={props.line}
              size="wide"
            />
          ) : null}
        </View>
        {props.state === "settling" ? (
          <Text tone="secondary" variant="label-small">
            {describeBodySettlingLine(props.readingCount)}
          </Text>
        ) : null}
        {props.state === "range-empty" ? (
          <Text tone="secondary" variant="label-small">
            {describeBodyRangeEmpty(range)}
          </Text>
        ) : null}
      </View>
    </Card>
  );
}
