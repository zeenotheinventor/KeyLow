import { PROGRAM_SCREEN } from "@keylow/core/copy";
import { View } from "react-native";

import { CountingNumeral } from "./CountingNumeral";
import { Badge, Card, Text } from "../../ui";

import type { ExpenditureHeroCardProps } from "./types";

/**
 * The estimate of what the person burns in a day, as `program: default` and `program: settling` draw it: the
 * eyebrow with the Estimate badge, and the Settling badge beside it while the estimate is still the starting
 * one, the whole kilocalories in the 40 point numeral of the Trend weight card, the likely range, and a line
 * about where the estimate comes from. The card is named by its figure and its range, as the Weight screen's is.
 * On the first open after a new check-in the figure counts up from the estimate before it (see `CountingNumeral`).
 */
export function ExpenditureHeroCard({ view, arrival }: ExpenditureHeroCardProps) {
  return (
    <Card aria-label={view.name}>
      <View className="gap-1">
        <View className="flex-row items-center justify-between gap-2">
          <Text className="uppercase tracking-[0.04em]" tone="secondary" variant="caption">
            {PROGRAM_SCREEN.hero.eyebrow}
          </Text>
          <View className="flex-row gap-1">
            {view.isSettling ? (
              <Badge tone="warning">{PROGRAM_SCREEN.hero.settlingBadge}</Badge>
            ) : null}
            <Badge tone="accent">{PROGRAM_SCREEN.hero.estimateBadge}</Badge>
          </View>
        </View>
        <View className="flex-row items-baseline gap-1">
          <CountingNumeral arrival={arrival} muKcal={view.muKcal} />
          <Text tone="secondary">{PROGRAM_SCREEN.hero.unit}</Text>
        </View>
        <Text className="tabular-nums">{view.rangeText}</Text>
        <Text className="tabular-nums" tone="secondary" variant="caption">
          {view.captionText}
        </Text>
      </View>
    </Card>
  );
}
