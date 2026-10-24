import { PROGRAM_EXPLAINER, describeExplainerSections } from "@keylow/core/copy";
import { Text as NativeText, View } from "react-native";

import { BottomSheet, Button, SheetScrollView, Text } from "../ui";

import type { ProgramExplainerSheetProps } from "./types";

// The board's sheet starts 60 points down a 844 point screen. A shorter phone scrolls what does not fit.
const SNAP_POINTS = ["93%"];

/**
 * The sheet that explains the programme, as `program-explainer: how it works` draws it: the title with Done on
 * one row, then the seven sections and the not-medical-advice line. The title and Done stay put and the rest
 * scrolls. The weekly check-in section names the weekday of `checkInDate`.
 */
export function ProgramExplainerSheet({ open, onClose, checkInDate }: ProgramExplainerSheetProps) {
  return (
    <BottomSheet
      label={PROGRAM_EXPLAINER.title}
      open={open}
      snapPoints={SNAP_POINTS}
      onClose={onClose}
    >
      {/* The sheet keeps 16 points at its sides and the board 20, so the contents take 4 more. */}
      <View className="flex-1 px-1">
        <View className="flex-row items-center justify-between pb-4">
          <Text role="heading" variant="h2">
            {PROGRAM_EXPLAINER.title}
          </Text>
          {/* The kit button pads 16 and has a 1 point border where the board's Done pads 8 and has none, so a 9 point pull puts its label's edge at the board's. */}
          <Button className="-mr-[9px]" tone="accent-ink" variant="ghost" onPress={onClose}>
            {PROGRAM_EXPLAINER.doneLabel}
          </Button>
        </View>
        <SheetScrollView className="flex-1" contentContainerClassName="gap-4 pb-2">
          <View className="gap-4">
            {describeExplainerSections(checkInDate).map((section) => (
              <View key={section.title} className="gap-1">
                <Text role="heading" variant="body-strong">
                  {section.title}
                </Text>
                {/* The board sets the paragraphs at 14 over 21 in the regular weight, which no Text variant has. */}
                <NativeText className="text-[14px] font-normal leading-[21px] tabular-nums text-text-secondary">
                  {section.text}
                </NativeText>
              </View>
            ))}
          </View>
          <Text tone="muted" variant="caption">
            {PROGRAM_EXPLAINER.notMedicalAdvice}
          </Text>
        </SheetScrollView>
      </View>
    </BottomSheet>
  );
}
