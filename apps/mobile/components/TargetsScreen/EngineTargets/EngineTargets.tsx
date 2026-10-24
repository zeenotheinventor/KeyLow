import {
  PROGRAM_TARGETS_SCREEN,
  TARGETS_SCREEN,
  describeTargetsScreenSince,
} from "@keylow/core/copy";
import { formatCalories, formatGrams } from "@keylow/core/format";
import { vars } from "nativewind";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button, Card, GroupedList, ListRow, Text } from "../../ui";
import { FOOTER_EXTRA_PADDING, MINIMUM_FOOTER_BOTTOM_PADDING } from "../footerPadding";

import type { EngineTargetsProps } from "./types";

/**
 * The Targets screen while a programme runs (`targets · engine`): the Programme row, this week's four targets
 * as rows that go nowhere, the Estimate my targets card, the note, and Set my own targets in the footer.
 */
export function EngineTargets({
  targets,
  since,
  estimateCard,
  onOpenProgramme,
  onSetOwnTargets,
}: EngineTargetsProps) {
  const insets = useSafeAreaInsets();
  const { kcal, protein_g, carbs_g, fat_g } = targets;

  return (
    <View className="flex-1">
      <ScrollView contentContainerClassName="gap-4 px-4 pb-4 pt-2">
        <Card padding={0}>
          <ListRow
            icon="ChartLine"
            subtitle={PROGRAM_TARGETS_SCREEN.programRow.subtitle}
            title={PROGRAM_TARGETS_SCREEN.programRow.title}
            onPress={onOpenProgramme}
          />
        </Card>
        <View className="gap-2">
          <View className="flex-row items-baseline justify-between gap-2 px-1">
            <Text role="heading" variant="body-strong">
              {PROGRAM_TARGETS_SCREEN.thisWeek}
            </Text>
            {since === undefined ? null : (
              <Text tone="muted" variant="caption">
                {describeTargetsScreenSince(since)}
              </Text>
            )}
          </View>
          <GroupedList
            hidesTitle
            label={PROGRAM_TARGETS_SCREEN.thisWeekList}
            title={PROGRAM_TARGETS_SCREEN.thisWeek}
          >
            <ListRow
              macro="calories"
              title={TARGETS_SCREEN.calories}
              unit={kcal === null ? undefined : "kcal"}
              value={kcal === null ? undefined : formatCalories(kcal)}
            />
            <ListRow
              macro="protein"
              title={TARGETS_SCREEN.protein}
              unit={protein_g === null ? undefined : "g"}
              value={protein_g === null ? undefined : formatGrams(protein_g)}
            />
            <ListRow
              macro="carbs"
              title={TARGETS_SCREEN.carbs}
              unit={carbs_g === null ? undefined : "g"}
              value={carbs_g === null ? undefined : formatGrams(carbs_g)}
            />
            <ListRow
              macro="fat"
              title={TARGETS_SCREEN.fat}
              unit={fat_g === null ? undefined : "g"}
              value={fat_g === null ? undefined : formatGrams(fat_g)}
            />
          </GroupedList>
        </View>
        {estimateCard}
        <Text tone="muted" variant="caption">
          {PROGRAM_TARGETS_SCREEN.engineNote}
        </Text>
      </ScrollView>
      {/* The footer's padding is a runtime value no class can name, so it goes through a variable. */}
      <View
        className="border-t border-border bg-surface-sheet px-4 pt-4 pb-[var(--footer-bottom-padding)]"
        style={vars({
          "--footer-bottom-padding": Math.max(
            insets.bottom + FOOTER_EXTRA_PADDING,
            MINIMUM_FOOTER_BOTTOM_PADDING,
          ),
        })}
      >
        <Button fullWidth size="lg" variant="secondary" onPress={onSetOwnTargets}>
          {PROGRAM_TARGETS_SCREEN.setOwnTargetsLabel}
        </Button>
      </View>
    </View>
  );
}
