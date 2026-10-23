import { View } from "react-native";

import { MuscleSheetHeader } from "../MuscleSheetHeader";
import { NotTargetedSheetBody } from "../NotTargetedSheetBody";
import { TargetedSheetBody } from "../TargetedSheetBody";

import type { MuscleSheetContentProps } from "./types";

/** The muscle sheet's header with the layout of a targeted muscle, or of one with no target. */
export function MuscleSheetContent({ copy, detail, onClose }: MuscleSheetContentProps) {
  return (
    <View className="gap-4">
      <MuscleSheetHeader subtitle={copy.subtitle} title={copy.title} onClose={onClose} />
      {copy.kind === "targeted" ? (
        <TargetedSheetBody copy={copy} detail={detail} />
      ) : (
        <NotTargetedSheetBody copy={copy} detail={detail} />
      )}
    </View>
  );
}
