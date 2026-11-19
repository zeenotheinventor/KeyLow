import {
  STREAK_WEEKS,
  describeTrainingStreak,
  describeWeekBars,
  describeWeighInStreak,
} from "@keylow/core/copy";
import { View } from "react-native";

import { Card, Icon, Text } from "../ui";

import type { WeeklyStreakCardProps } from "./types";
import type { WeekState } from "@keylow/core";

// The classes are written out so Tailwind sees them. A week that counted is the accent, one that did not
// is the raised surface, and this week, until it counts, is drawn in the warning colours.
const barFill = {
  complete: "bg-accent",
  missed: "bg-surface-raised",
  at_risk: "border border-warning bg-warning-muted",
} satisfies Record<WeekState, string>;

function TrainingCard({ streak, recent }: Extract<WeeklyStreakCardProps, { kind: "training" }>) {
  const { title, best, progress } = describeTrainingStreak({
    current: streak.current,
    longest: streak.longest,
    achieved: recent.achieved,
    required: recent.required,
  });

  return (
    <Card>
      <View className="gap-3">
        <View className="flex-row items-baseline justify-between gap-2">
          <Text className="flex-1" role="heading" variant="body-strong">
            {title}
          </Text>
          {best === null ? null : (
            <Text tone="muted" variant="caption">
              {best}
            </Text>
          )}
        </View>
        <View
          aria-label={STREAK_WEEKS.barsName(recent.bars.length)}
          className="flex-row items-end gap-[6px]"
          role="group"
        >
          {describeWeekBars(recent.bars).map((bar) => (
            <View
              accessible
              aria-label={bar.name}
              className="flex-1 items-center gap-1"
              key={bar.weekStart}
            >
              <View className={`h-7 w-full rounded-[8px] ${barFill[bar.state]}`} />
              <Text tone="muted" variant="caption">
                {bar.label}
              </Text>
            </View>
          ))}
        </View>
        <Text tone="secondary">{progress}</Text>
      </View>
    </Card>
  );
}

function WeighInCard({ streak }: Extract<WeeklyStreakCardProps, { kind: "weigh_in" }>) {
  const { title, detail } = describeWeighInStreak(streak);

  return (
    <Card>
      <View className="flex-row items-center gap-3">
        {streak.thisWeek === "complete" ? (
          <Icon name="Check" size={28} tone="accent-ink" />
        ) : (
          <Icon name="CircleDashed" size={28} tone="warning-ink" />
        )}
        <View className="flex-1">
          <Text role="heading" variant="body-strong">
            {title}
          </Text>
          <Text tone="secondary">{detail}</Text>
        </View>
      </View>
    </Card>
  );
}

/**
 * The weekly streak card, as board 4 draws it: on the Train tab the training streak with its best, the last
 * eight weeks as bars and how this week is going, and on the Weight screen the weigh-in streak with
 * whether this week has one and the best. Weekly streaks use no freezes, and neither card names a weight.
 */
export function WeeklyStreakCard(props: WeeklyStreakCardProps) {
  return props.kind === "training" ? <TrainingCard {...props} /> : <WeighInCard {...props} />;
}
