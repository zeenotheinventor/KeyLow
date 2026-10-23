import { Text as NativeText, View } from "react-native";

import type { HealthAccessStepsProps } from "./types";

/**
 * The install and denied states' numbered steps on a surface, in the 14 over 22 secondary text of the board.
 * The number sits in the 32 points of left padding the board gives the list, so the sentences start 32 points in.
 */
export function HealthAccessSteps({ steps }: HealthAccessStepsProps) {
  return (
    <View className="rounded-large border border-border bg-surface px-4 py-3" role="list">
      {steps.map((step, index) => (
        <View key={step} accessible className="flex-row gap-1" role="listitem">
          <NativeText
            aria-hidden
            className="w-[12px] text-right text-label-small font-normal leading-[22px] tabular-nums text-text-secondary"
          >
            {`${index + 1}.`}
          </NativeText>
          <NativeText className="flex-1 text-label-small font-normal leading-[22px] tabular-nums text-text-secondary">
            {step}
          </NativeText>
        </View>
      ))}
    </View>
  );
}
