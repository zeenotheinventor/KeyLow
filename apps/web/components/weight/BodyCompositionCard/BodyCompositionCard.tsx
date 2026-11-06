import {
  BODY_COMPOSITION,
  WEIGHT_SCREEN,
  describeBodyChange,
  describeBodyChartName,
  describeBodyRangeEmpty,
  describeBodySettlingLine,
  describeBodyValue,
} from "@keylow/core/copy";

import type { BodyCompositionCardProps } from "./types";

import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Sparkline } from "@/components/ui/Sparkline";

/**
 * One labelled value of the Weight page's Body composition section, as the `web-weight, body-composition-cards`
 * board draws it: the label and one badge on the first row, the trend to one decimal with its unit and the
 * 128 by 40 trend line, and under them the reason when there is no change to show. A settled trend with a
 * change has the change badge and the line. A trend that is still settling has the "Settling" badge, the count
 * so far and the line when the range holds a point of it, with no change badge. A range with fewer than two
 * readings has the reason, with no badge and no line. It is a region named by its label.
 */
export function BodyCompositionCard(props: BodyCompositionCardProps) {
  const { kind, trend, range } = props;
  const { label } = BODY_COMPOSITION.kinds[kind];
  const { valueText, unit } = describeBodyValue(kind, trend);

  return (
    <Card asChild className="flex min-w-0 flex-col gap-1">
      <section aria-label={label}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-caption uppercase tracking-[0.04em] text-text-secondary">
            {label}
          </span>
          {props.state === "settling" ? (
            <Badge tone="warning">{WEIGHT_SCREEN.settlingBadge}</Badge>
          ) : null}
          {props.state === "chart" ? (
            <Badge tone="accent">{describeBodyChange(kind, props.change, range)}</Badge>
          ) : null}
        </div>
        <div className="flex items-end justify-between gap-3">
          <div className="flex items-baseline gap-1 tabular-nums">
            {/* The board sets the value at 32 over 38, which is between the type scale's sizes, as the trend weight is. */}
            <span className="text-[32px] font-semibold leading-[38px] tracking-[-0.02em]">
              {valueText}
            </span>
            <span className="text-body text-text-secondary">{unit}</span>
          </div>
          {(props.state === "chart" || props.state === "settling") && props.line !== null ? (
            <Sparkline
              label={describeBodyChartName(kind, range, trend)}
              points={props.line}
              size="wide"
            />
          ) : null}
        </div>
        {props.state === "settling" ? (
          // The board draws the line in the label size at the regular weight, which no type class has.
          <span className="text-[14px] font-normal leading-5 tabular-nums text-text-secondary">
            {describeBodySettlingLine(props.readingCount)}
          </span>
        ) : null}
        {props.state === "range-empty" ? (
          <span className="text-[14px] font-normal leading-5 tabular-nums text-text-secondary">
            {describeBodyRangeEmpty(range)}
          </span>
        ) : null}
      </section>
    </Card>
  );
}
