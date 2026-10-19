import { View } from "react-native";

import { TodayCard } from "./TodayCard";

import type { Meta, StoryObj } from "@storybook/react-native";

const meta = {
  title: "Train/TodayCard",
  component: TodayCard,
  decorators: [
    (Story) => (
      <View className="p-4">
        <Story />
      </View>
    ),
  ],
  args: {
    // The golden week on Thursday 15 October, as the `train · today` board draws it.
    card: {
      kind: "planned",
      routineName: "Push Pull Legs",
      dayName: "Legs",
      dayNumber: 3,
      dayCount: 4,
      exerciseCount: 5,
      setCount: 16,
      estimatedMinutes: 50,
    },
    context: { localDate: "2026-10-15", nextExerciseName: "Leg Press", recovery: null },
    isStartAndResumeDisabled: false,
    onStart: () => undefined,
    onResume: () => undefined,
    onViewSession: () => undefined,
    onLogAnother: () => undefined,
    onLogSession: () => undefined,
  },
} satisfies Meta<typeof TodayCard>;

export default meta;

type Story = StoryObj<typeof meta>;

// The day ahead, with Start.
export const Planned: Story = {};

// Offline: the card shows from the cache and Start is dimmed.
export const PlannedOffline: Story = { args: { isStartAndResumeDisabled: true } };

// Thursday 19:00, the Legs session open with 8 of 16 sets logged.
export const InProgress: Story = {
  args: {
    card: {
      kind: "in_progress",
      dayName: "Legs",
      minutesSoFar: 30,
      setsLogged: 8,
      setsPlanned: 16,
      nextSet: { exerciseId: "leg-press", setNumber: 3 },
    },
  },
};

// The session finished, with the next planned day.
export const Done: Story = {
  args: {
    card: {
      kind: "done",
      dayName: "Legs",
      minutes: 30,
      setsLogged: 8,
      setsPlanned: 16,
      next: { date: "2026-10-17", id: "push", name: "Push" },
    },
  },
};

// Offline: Log another session is dimmed, View session reads what is saved and stays enabled.
export const DoneOffline: Story = {
  args: { ...Done.args, isStartAndResumeDisabled: true },
};

// A second session takes the day past the sets it plans, so the line counts the sets alone.
export const DoneAfterASecondSession: Story = {
  args: {
    card: {
      kind: "done",
      dayName: "Legs",
      minutes: 75,
      setsLogged: 18,
      setsPlanned: 16,
      next: { date: "2026-10-17", id: "push", name: "Push" },
    },
  },
};

// Wednesday 14 October, with the muscles still recovering as the `train · rest-day` board draws them.
export const Rest: Story = {
  args: {
    card: { kind: "rest", next: { date: "2026-10-15", id: "legs", name: "Legs" } },
    context: {
      localDate: "2026-10-14",
      nextExerciseName: null,
      recovery: { muscles: ["lats", "biceps"], trainedOn: "2026-10-13" },
    },
  },
};

// Offline: Log a session is dimmed.
export const RestOffline: Story = {
  args: { ...Rest.args, isStartAndResumeDisabled: true },
};
