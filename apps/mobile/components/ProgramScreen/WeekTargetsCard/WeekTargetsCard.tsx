import { PROGRAM_SCREEN, SETUP_ESTIMATE } from "@keylow/core/copy";
import { Text as NativeText, View } from "react-native";

import { Card, Icon, ListRow, MacroTile, Text } from "../../ui";

import type { WeekTargetsCardProps } from "./types";

/**
 * This week's targets as `program: default` draws them: the eyebrow with the day they were set, the calories in
 * a 32 point numeral, the line about what they are worth a week (or the guardrail that set them), the three
 * macros as the setup estimate's tiles, and the next check-in row under a hairline. The row waits for a date.
 * The card is named by its calories, and its macros and its row are read on their own.
 */
export function WeekTargetsCard({ view }: WeekTargetsCardProps) {
  const { checkIn, macros } = view;

  return (
    <Card aria-label={view.name} padding={0}>
      <View className="gap-2 p-4">
        <View className="flex-row items-center justify-between gap-2">
          <Text className="uppercase tracking-[0.04em]" tone="secondary" variant="caption">
            {PROGRAM_SCREEN.targets.eyebrow}
          </Text>
          <Text className="tabular-nums" tone="muted" variant="caption">
            {view.sinceText}
          </Text>
        </View>
        <View className="flex-row items-baseline gap-1">
          {/* The design sets the figure at 32 over 38, which is between the type scale's sizes. */}
          <NativeText className="text-[32px] font-semibold leading-[38px] tracking-[-0.02em] tabular-nums text-text-primary">
            {view.kcalText}
          </NativeText>
          <Text tone="secondary">{PROGRAM_SCREEN.targets.unit}</Text>
        </View>
        {view.line === null ? null : view.isGuardrail ? (
          // A guardrail line is the caption with an Info icon before it, as `Guardrail line` on the canvas draws it.
          <View className="flex-row items-start gap-2">
            <Icon name="Info" size={16} tone="secondary" />
            <Text className="min-w-0 flex-1 tabular-nums" tone="secondary" variant="caption">
              {view.line}
            </Text>
          </View>
        ) : (
          <Text className="tabular-nums" tone="secondary">
            {view.line}
          </Text>
        )}
        {macros === null ? null : (
          <View className="mt-1 flex-row gap-2">
            <MacroTile
              grams={macros.proteinG}
              label={SETUP_ESTIMATE.tileLabels.protein}
              macro="protein"
              share={null}
            />
            <MacroTile
              grams={macros.carbsG}
              label={SETUP_ESTIMATE.tileLabels.carbs}
              macro="carbs"
              share={null}
            />
            <MacroTile
              grams={macros.fatG}
              label={SETUP_ESTIMATE.tileLabels.fat}
              macro="fat"
              share={null}
            />
          </View>
        )}
      </View>
      {checkIn === null ? null : (
        <View className="border-t border-border">
          <ListRow
            icon="Calendar"
            subtitle={checkIn.caption}
            title={checkIn.title}
            value={checkIn.dateText}
            valueLook="quiet"
          />
        </View>
      )}
    </Card>
  );
}
