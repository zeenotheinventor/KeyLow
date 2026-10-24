import { SETUP_ESTIMATE } from "@keylow/core/copy";
import { formatCalories } from "@keylow/core/format";
import { easingCurve, motionDuration, stagger } from "@keylow/tokens";
import { useEffect, useState } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

import { haptic } from "../../../../../lib/haptics";
import { useCountUp, useReducedMotion } from "../../../../../lib/motion";
import { useTheme } from "../../../../../lib/theme";
import { Badge, Card, Icon, MacroTile, SlashSweep, Text } from "../../../../ui";
import { CutIn } from "../CutIn";

import type { EstimateCardProps } from "./types";

// The design's `kl-flash`: the numeral is the accent from the first frame, and 200 ms in, while it is
// still counting, it returns to its own colour over `--duration-chart` with `--ease-whip`.
const flashEasing = Easing.bezier(...easingCurve.whip);
const flashDelay = 200;

// The first tile cuts in 160 ms after arrival and the next two follow 36 ms apart, as the board draws them.
const firstTileDelay = 160;

/**
 * The calorie target of the estimate, with the onboarding flourish the design system reserves one of. On
 * arrival the numeral counts up from nothing and flashes the accent, one accent slash crosses
 * the card, the three tiles cut in from the side 36 ms apart and the confirm haptic plays, once. With
 * reduced motion there is no count, flash or slash, and the tiles only fade.
 */
export function EstimateCard({ targets, lines }: EstimateCardProps) {
  const { colors } = useTheme();
  const isReducedMotion = useReducedMotion();

  // The count starts from nothing and is told its target on the next frame, so it has somewhere to count from.
  const [hasArrived, setHasArrived] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setHasArrived(true);
    });

    return () => {
      cancelAnimationFrame(frame);
    };
  }, []);
  useEffect(() => {
    void haptic.confirm();
  }, []);
  const { value } = useCountUp(
    hasArrived || isReducedMotion ? targets.caloriesKcal : 0,
    isReducedMotion,
  );

  const flash = useSharedValue(1);
  useEffect(() => {
    if (isReducedMotion) {
      flash.set(0);
    } else {
      flash.set(
        withDelay(
          flashDelay,
          withTiming(0, { duration: motionDuration.chart, easing: flashEasing }),
        ),
      );
    }
  }, [flash, isReducedMotion]);

  const restingColor = colors["text-primary"];
  const accent = colors.accent;
  const flashStyle = useAnimatedStyle(() => ({
    color: interpolateColor(flash.get(), [0, 1], [restingColor, accent]),
  }));

  return (
    <Card aria-label={SETUP_ESTIMATE.card.name} role="group">
      {isReducedMotion ? null : <SlashSweep variant="card" />}
      <View className="gap-2">
        <View className="flex-row items-center justify-between">
          <Text tone="secondary" variant="body-strong">
            {SETUP_ESTIMATE.card.title}
          </Text>
          <Badge tone="accent">{SETUP_ESTIMATE.card.badge}</Badge>
        </View>
        <View className="flex-row items-baseline gap-[6px]">
          <Text variant="display-numeral">
            <Animated.Text style={flashStyle}>{formatCalories(value)}</Animated.Text>
          </Text>
          <Text tone="secondary">{SETUP_ESTIMATE.card.caloriesUnit}</Text>
        </View>
        {lines.rateLine === undefined ? null : <Text tone="secondary">{lines.rateLine}</Text>}
        {lines.guardrailLines.map((line) => (
          <View key={line} className="flex-row items-start gap-2">
            <View className="pt-[2px]">
              <Icon name="Info" size="sm" tone="secondary" />
            </View>
            <Text className="flex-1" tone="secondary" variant="caption">
              {line}
            </Text>
          </View>
        ))}
        <View className="mt-2 flex-row gap-2">
          <CutIn delay={firstTileDelay}>
            <MacroTile
              grams={targets.proteinG}
              label={SETUP_ESTIMATE.tileLabels.protein}
              macro="protein"
              share={null}
            />
          </CutIn>
          <CutIn delay={firstTileDelay + stagger}>
            <MacroTile
              grams={targets.carbsG}
              label={SETUP_ESTIMATE.tileLabels.carbohydrate}
              macro="carbs"
              share={null}
            />
          </CutIn>
          <CutIn delay={firstTileDelay + 2 * stagger}>
            <MacroTile
              grams={targets.fatG}
              label={SETUP_ESTIMATE.tileLabels.fat}
              macro="fat"
              share={null}
            />
          </CutIn>
        </View>
      </View>
    </Card>
  );
}
