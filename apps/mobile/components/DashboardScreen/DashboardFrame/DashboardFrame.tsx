import { TAB_TITLES } from "@keylow/core/copy";
import { View } from "react-native";

import { DashboardHeader } from "../DashboardHeader";

import type { DashboardFrameProps } from "./types";

/** The dashboard's header over whatever the screen shows under it, so every state keeps its title. */
export function DashboardFrame({ eyebrow, children }: DashboardFrameProps) {
  return (
    <View className="flex-1 bg-background">
      <DashboardHeader eyebrow={eyebrow} title={TAB_TITLES.dashboard} />
      {children}
    </View>
  );
}
