import { ASSISTANT_SHEET, DAY_STEPPER } from "@keylow/core/copy";
import { View } from "react-native";

import { DiaryHeader } from "../DiaryHeader";

import type { DiaryFrameProps } from "./types";

/** The diary's header over whatever the screen shows under it. */
export function DiaryFrame({
  title = DAY_STEPPER.today,
  moreLabel,
  onAssistant,
  onChooseDate,
  onMore,
  children,
}: DiaryFrameProps) {
  return (
    <View className="flex-1 bg-background">
      <DiaryHeader
        assistantLabel={ASSISTANT_SHEET.title}
        chooseDateLabel={DAY_STEPPER.chooseDate}
        moreLabel={moreLabel}
        title={title}
        onAssistant={onAssistant}
        onChooseDate={onChooseDate}
        onMore={onMore}
      />
      {children}
    </View>
  );
}
