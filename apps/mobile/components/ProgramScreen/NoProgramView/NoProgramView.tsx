import { PROGRAM_NO_PROGRAM, describeOwnTargetsStay } from "@keylow/core/copy";
import { useRouter } from "expo-router";
import { ScrollView } from "react-native";

import { useOpenOnce } from "../../../lib/useOpenOnce";
import { EmptyState, Text } from "../../ui";

import type { NoProgramViewProps } from "./types";

/**
 * `program: no-program`, for a user on their own targets: the chart tile, what a programme does in three
 * points, and Estimate my targets, which opens the wizard in recalculate mode. Under the button the user's own
 * calorie target stays until they start, when they have one. The not-medical-advice line sits at the foot. It
 * scrolls, so a short phone or large text never clips the button or the line.
 */
export function NoProgramView({ ownTargetKcal }: NoProgramViewProps) {
  const router = useRouter();
  const openOnce = useOpenOnce();

  return (
    <ScrollView className="flex-1" contentContainerClassName="flex-grow pb-4">
      <EmptyState
        action={{
          label: PROGRAM_NO_PROGRAM.startLabel,
          variant: "primary",
          onPress: () => {
            openOnce(() => {
              router.push("/setup?mode=recalculate");
            });
          },
        }}
        body={PROGRAM_NO_PROGRAM.body}
        icon="ChartLine"
        points={[
          { icon: "Calculator", text: PROGRAM_NO_PROGRAM.points[0] },
          { icon: "Scale", text: PROGRAM_NO_PROGRAM.points[1] },
          { icon: "Target", text: PROGRAM_NO_PROGRAM.points[2] },
        ]}
        title={PROGRAM_NO_PROGRAM.title}
      />
      {ownTargetKcal === null ? null : (
        <Text className="mt-2 px-4 text-center tabular-nums" tone="secondary" variant="caption">
          {describeOwnTargetsStay(ownTargetKcal)}
        </Text>
      )}
      <Text className="mt-auto px-4" tone="muted" variant="caption">
        {PROGRAM_NO_PROGRAM.notMedicalAdvice}
      </Text>
    </ScrollView>
  );
}
