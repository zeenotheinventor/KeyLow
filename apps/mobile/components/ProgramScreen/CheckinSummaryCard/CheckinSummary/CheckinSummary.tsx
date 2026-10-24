import { PROGRAM_CHECKIN_SUMMARY } from "@keylow/core/copy";
import { View } from "react-native";
import Animated from "react-native-reanimated";

import { useCutInStyle } from "../../../../lib/motion";
import { Badge, Card, Text } from "../../../ui";
import { SummaryLine } from "../SummaryLine";

import type { CheckinSummaryProps } from "./types";

/**
 * The card as `checkin-summary` and `program: default` draw it: the eyebrow with the check-in's date and the
 * Measured or Not measured badge, the expenditure and the calorie target as two rows, and the lines that say why.
 * It is named "Last check-in, Friday 9 October, measured". It is mounted once it has something to say, which is
 * when its cut-in starts: from the side, or only a fade with reduced motion.
 */
export function CheckinSummary({ view, isArriving }: CheckinSummaryProps) {
  const arrivalStyle = useCutInStyle(isArriving);

  return (
    // A class and an animated style cannot share an element, so the cut-in is on a wrapper of its own that names the card.
    <Animated.View aria-label={view.name} role="group" style={arrivalStyle}>
      <Card>
        <View className="gap-3">
          <View className="flex-row items-start justify-between gap-2">
            <View className="gap-[2px]">
              <Text className="uppercase tracking-[0.04em]" tone="secondary" variant="caption">
                {PROGRAM_CHECKIN_SUMMARY.eyebrow}
              </Text>
              <Text className="tabular-nums" variant="body-strong">
                {view.dateText}
              </Text>
            </View>
            <Badge tone={view.isMeasured ? "neutral" : "warning"}>
              {view.isMeasured
                ? PROGRAM_CHECKIN_SUMMARY.measured
                : PROGRAM_CHECKIN_SUMMARY.notMeasured}
            </Badge>
          </View>
          <View>
            {view.rows.map((row) => (
              <View
                key={row.label}
                accessible
                aria-label={row.name}
                className="flex-row items-baseline justify-between gap-3 border-t border-border py-2"
              >
                <Text tone="secondary">{row.label}</Text>
                <Text className="flex-1 text-right tabular-nums" variant="body-strong">
                  {row.value}
                </Text>
              </View>
            ))}
          </View>
          {view.lines.map((line) => (
            <SummaryLine key={`${line.kind}:${line.text}`} kind={line.kind} text={line.text} />
          ))}
        </View>
      </Card>
    </Animated.View>
  );
}
