import { TAB_TITLES } from "@keylow/core/copy";
import { useState } from "react";
import { View } from "react-native";

import { useStreakView } from "../../../lib/streaks";
import { StreakCalendarSheet } from "../../StreakCalendarSheet";
import { StreakChip } from "../../StreakChip";
import { DashboardHeader } from "../DashboardHeader";

import type { DashboardFrameProps } from "./types";

/**
 * The dashboard's header over whatever the screen shows under it, so every state keeps its title. The
 * streak chip sits in the header once the streak is read, and opens the calendar sheet, which is mounted
 * here because a sheet covers the screen it is mounted in and the header is only its top.
 */
export function DashboardFrame({ eyebrow, children }: DashboardFrameProps) {
  const streak = useStreakView();
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  return (
    <View className="flex-1 bg-background">
      <DashboardHeader
        eyebrow={eyebrow}
        title={TAB_TITLES.dashboard}
        trailing={
          streak === undefined ? undefined : (
            <StreakChip
              current={streak.daily.current}
              state={streak.chipState}
              onPress={() => {
                setIsCalendarOpen(true);
              }}
            />
          )
        }
      />
      {children}
      {streak === undefined ? null : (
        <StreakCalendarSheet
          open={isCalendarOpen}
          view={streak}
          onClose={() => {
            setIsCalendarOpen(false);
          }}
        />
      )}
    </View>
  );
}
