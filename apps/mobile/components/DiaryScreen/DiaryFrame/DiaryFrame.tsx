import { DAY_STEPPER } from "@keylow/core/copy";
import { View } from "react-native";

import { DiaryHeader } from "../DiaryHeader";

import type { DiaryFrameProps } from "./types";

/** The diary's header over whatever the screen shows under it. */
export function DiaryFrame({ title = DAY_STEPPER.today, moreLabel, children }: DiaryFrameProps) {
  return (
    <View className="flex-1 bg-background">
      <DiaryHeader chooseDateLabel={DAY_STEPPER.chooseDate} moreLabel={moreLabel} title={title} />
      {children}
    </View>
  );
}
