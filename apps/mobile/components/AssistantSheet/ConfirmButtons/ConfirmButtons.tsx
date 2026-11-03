import { View } from "react-native";

import { Button } from "../../ui";

import type { ConfirmButtonsProps } from "./types";

/**
 * The two answers under a confirmation (`assistant · confirm`): the action in its tone, then the cancel
 * in the secondary look, side by side in equal widths. Both words arrive with the question, and pressing
 * one sends it as your message.
 */
export function ConfirmButtons({
  confirmLabel,
  cancelLabel,
  tone,
  isAnswered,
  onAnswer,
}: ConfirmButtonsProps) {
  return (
    <View className="flex-row gap-2">
      <Button
        className="min-w-0 flex-1"
        disabled={isAnswered}
        variant={tone === "danger" ? "destructive" : "primary"}
        onPress={() => {
          onAnswer(confirmLabel);
        }}
      >
        {confirmLabel}
      </Button>
      <Button
        className="min-w-0 flex-1"
        disabled={isAnswered}
        variant="secondary"
        onPress={() => {
          onAnswer(cancelLabel);
        }}
      >
        {cancelLabel}
      </Button>
    </View>
  );
}
