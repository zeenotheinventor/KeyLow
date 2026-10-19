import { View } from "react-native";

import { HistoryWeekSection } from "./HistoryWeekSection";

import type { HistoryEntry, HistoryWeek } from "@keylow/api-client";
import type { MuscleId, SessionSummary } from "@keylow/core/training";
import type { Meta, StoryObj } from "@storybook/react-native";

const entry = (
  id: string,
  localDate: string,
  titleSource: string,
  durationMinutes: number | null,
  workingSets: number,
  topMuscles: MuscleId[],
): HistoryEntry => {
  const summary: SessionSummary = {
    durationMinutes,
    workingSets,
    warmupSets: 0,
    topMuscles,
    titleSource,
    planComparison: null,
  };
  return {
    id,
    local_date: localDate,
    routine_day_id: null,
    started_at: `${localDate}T18:00:00+01:00`,
    ended_at: null,
    deleted_at: null,
    routine_day_name: titleSource,
    sets: [],
    summary,
  };
};

// The golden week of the `history · list` board, Monday 12 to Sunday 18 October.
const goldenWeek: HistoryWeek = {
  weekStart: "2026-10-12",
  sessionCount: 3,
  workingSetTotal: 41,
  sessions: [
    entry("legs", "2026-10-15", "Legs", 30, 8, ["hamstrings", "quads", "glute_max"]),
    entry("pull", "2026-10-13", "Pull", 51, 17, ["lats", "biceps", "traps_mid"]),
    entry("push", "2026-10-12", "Push", 48, 16, ["triceps", "delt_front", "delt_side"]),
  ],
};

const meta = {
  title: "Train/HistoryWeekSection",
  component: HistoryWeekSection,
  decorators: [
    (Story) => (
      <View className="p-4">
        <Story />
      </View>
    ),
  ],
  args: { week: goldenWeek, thisWeekStart: "2026-10-12", onOpenSession: () => undefined },
} satisfies Meta<typeof HistoryWeekSection>;

export default meta;

type Story = StoryObj<typeof meta>;

// The week that holds today is named This week.
export const ThisWeek: Story = {};

// The week before it is Last week, and an older one is named by its days alone.
export const LastWeek: Story = {
  args: { thisWeekStart: "2026-10-19" },
};

export const OlderWeek: Story = {
  args: { thisWeekStart: "2026-11-02" },
};
