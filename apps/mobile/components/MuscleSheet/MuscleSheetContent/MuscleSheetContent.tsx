import { View } from "react-native";

import { MuscleSheetHeader } from "../MuscleSheetHeader";
import { NotTrainedSheetBody } from "../NotTrainedSheetBody";
import { TrainedSheetBody } from "../TrainedSheetBody";

import type { MuscleSheetContentProps } from "./types";

/** The muscle sheet's header with the layout of a muscle with sets this week, or of one with none. */
export function MuscleSheetContent({ copy, detail, onClose }: MuscleSheetContentProps) {
  return (
    <View className="gap-4">
      <MuscleSheetHeader subtitle={copy.subtitle} title={copy.title} onClose={onClose} />
      {copy.kind === "trained" ? (
        <TrainedSheetBody copy={copy} detail={detail} />
      ) : (
        <NotTrainedSheetBody copy={copy} detail={detail} />
      )}
    </View>
  );
}
