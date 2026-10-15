import { DASHBOARD_CARD, describeDashboardCard, describeTargetCaption } from "@keylow/core/copy";
import { View } from "react-native";

import { rowPressScale } from "../../../lib/motion";
import { Button, CalorieRing, Card, Icon, MacroBars, PressableSurface, Text } from "../../ui";

import type { NutritionCardProps } from "./types";

/**
 * Today's nutrition as the dashboard board draws it: the card's title with a chevron, the calorie ring and
 * the three macro bars, all one button that opens the Diary for today, named by the title, the ring and the
 * bars. Under a hairline, outside that button so there are no nested buttons, sit the calorie target and
 * Edit, which opens Targets. The footer is left off when no calorie target is set. The ring and the bars
 * are read as part of the button's name, so a screen reader does not step into them on their own.
 */
export function NutritionCard({ totals, targets, onOpenDiary, onEditTargets }: NutritionCardProps) {
  const calorieTarget = targets.kcal ?? 0;
  const hasTarget = calorieTarget > 0;

  return (
    <Card padding={0}>
      <PressableSurface
        className={`px-4 pt-4 ${hasTarget ? "pb-3" : "pb-4"}`}
        label={describeDashboardCard(totals, targets)}
        pressScale={rowPressScale}
        onPress={onOpenDiary}
      >
        <View aria-hidden className="gap-4">
          <View className="flex-row items-center gap-2">
            <Text className="flex-1" variant="h2">
              {DASHBOARD_CARD.title}
            </Text>
            <Icon name="ChevronRight" size="sm" tone="muted" />
          </View>
          <View className="items-center">
            <CalorieRing eaten={totals.kcal ?? 0} estimate={false} target={calorieTarget} />
          </View>
          <MacroBars
            carbs={{ eaten: totals.carbs_g ?? 0, target: targets.carbs_g ?? 0 }}
            fat={{ eaten: totals.fat_g ?? 0, target: targets.fat_g ?? 0 }}
            protein={{ eaten: totals.protein_g ?? 0, target: targets.protein_g ?? 0 }}
          />
        </View>
      </PressableSurface>
      {hasTarget ? (
        <View className="mx-4 min-h-touch-target flex-row items-center justify-between gap-3 border-t border-border py-1">
          <Text tone="secondary" variant="caption">
            {describeTargetCaption(calorieTarget)}
          </Text>
          <Button
            accessibilityLabel={DASHBOARD_CARD.editName}
            className="-mr-3"
            tone="accent-ink"
            variant="ghost"
            onPress={onEditTargets}
          >
            {DASHBOARD_CARD.edit}
          </Button>
        </View>
      ) : null}
    </Card>
  );
}
