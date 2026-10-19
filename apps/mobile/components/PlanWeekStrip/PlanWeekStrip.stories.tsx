import { weekPlanDays } from "@keylow/core/training";
import { View } from "react-native";

import { PlanWeekStrip } from "./PlanWeekStrip";

import type { WeekRoutine, WeekSession } from "@keylow/core/training";
import type { Meta, StoryObj } from "@storybook/react-native";

const WEEK_START = "2026-10-12";

const routineDay = (id: string, name: string, weekday: number, position: number) => ({
  id,
  name,
  position,
  weekday,
  exercises: [1, 2, 3, 4].map((exercisePosition) => ({
    position: exercisePosition,
    exercise_id: `${id}-${exercisePosition}`,
    target_sets: 4,
  })),
});

// The golden week (KEY-353): Push on Monday, Pull on Tuesday, Legs on Thursday, Push on Saturday.
const routine: WeekRoutine = {
  name: "Push Pull Legs",
  activeFrom: "2026-10-01",
  days: [
    routineDay("push-monday", "Push", 0, 1),
    routineDay("pull", "Pull", 1, 2),
    routineDay("legs", "Legs", 3, 3),
    routineDay("push-saturday", "Push", 5, 4),
  ],
};

const session = (
  id: string,
  localDate: string,
  routineDayId: string | null,
  endedAt: string | null,
): WeekSession => ({
  id,
  local_date: localDate,
  started_at: `${localDate}T18:00:00+01:00`,
  ended_at: endedAt,
  routine_day_id: routineDayId,
  deleted_at: null,
  sets: Array.from({ length: 16 }, (_, index) => ({
    exercise_id: `exercise-${index}`,
    set_type: "working" as const,
    deleted_at: null,
  })),
});

const monday = session("monday", "2026-10-12", "push-monday", "2026-10-12T18:48:00+01:00");
const tuesday = session("tuesday", "2026-10-13", "pull", "2026-10-13T18:51:00+01:00");

const meta = {
  title: "Train/PlanWeekStrip",
  component: PlanWeekStrip,
  decorators: [
    (Story) => (
      <View className="p-4">
        <Story />
      </View>
    ),
  ],
  args: {
    weekStart: WEEK_START,
    // Thursday 15 October, 17:55 in London: Monday and Tuesday logged, Legs to do, Push to come.
    week: weekPlanDays({
      routine,
      sessions: [monday, tuesday],
      now: "2026-10-15T16:55:00Z",
      tz: "Europe/London",
      weekStart: WEEK_START,
    }),
  },
} satisfies Meta<typeof PlanWeekStrip>;

export default meta;

type Story = StoryObj<typeof meta>;

// The `train · today` board.
export const Today: Story = {};

// Sunday 20:00: Thursday's Legs and Saturday's Push were not logged, so both read missed.
export const Missed: Story = {
  args: {
    week: weekPlanDays({
      routine,
      sessions: [monday, tuesday],
      now: "2026-10-18T19:00:00Z",
      tz: "Europe/London",
      weekStart: WEEK_START,
    }),
  },
};

// Thursday 19:00 with Legs open.
export const InProgress: Story = {
  args: {
    week: weekPlanDays({
      routine,
      sessions: [monday, tuesday, session("thursday", "2026-10-15", "legs", null)],
      now: "2026-10-15T18:00:00Z",
      tz: "Europe/London",
      weekStart: WEEK_START,
    }),
  },
};

// No routine: the sessions of the week are counted in the caption, and a day with none says nothing logged.
export const NoRoutine: Story = {
  args: {
    week: weekPlanDays({
      routine: null,
      sessions: [session("free-monday", "2026-10-12", null, "2026-10-12T18:48:00+01:00")],
      now: "2026-10-15T16:55:00Z",
      tz: "Europe/London",
      weekStart: WEEK_START,
    }),
  },
};
