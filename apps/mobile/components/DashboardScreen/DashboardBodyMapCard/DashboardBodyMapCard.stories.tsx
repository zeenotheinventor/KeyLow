import { View } from "react-native";

import { DashboardBodyMapCard } from "./DashboardBodyMapCard";
import { RESTING_HEAT } from "./restingHeat";

import type { DashboardBodyMap } from "@keylow/api-client";
import type { Meta, StoryObj } from "@storybook/react-native";

// The golden week at Thursday 17:55, as the `dashboard · training-card` board draws it.
const goldenThursday: DashboardBodyMap = {
  values: {
    ...RESTING_HEAT,
    chest_upper: 1,
    chest_lower: 1,
    delt_rear: 1,
    lats: 2,
    traps_mid: 1,
    biceps: 1,
    triceps: 1,
  },
  warmest: [
    { muscle: "lats", percent: 25 },
    { muscle: "traps_mid", percent: 18 },
    { muscle: "biceps", percent: 15 },
  ],
  today: { kind: "planned", dayName: "Legs", setCount: 16 },
};

const meta = {
  title: "Dashboard/DashboardBodyMapCard",
  component: DashboardBodyMapCard,
  decorators: [
    (Story) => (
      <View className="flex-1 justify-center p-4">
        <Story />
      </View>
    ),
  ],
  args: { bodyMap: goldenThursday, onOpen: () => undefined },
} satisfies Meta<typeof DashboardBodyMapCard>;

export default meta;

type Story = StoryObj<typeof meta>;

// Legs planned for today, with the three warmest muscles.
export const PlannedDay: Story = {};

// A session in progress on the day the routine plans.
export const SessionInProgress: Story = {
  args: {
    bodyMap: {
      ...goldenThursday,
      today: { kind: "in_progress", dayName: "Legs", setsPlanned: 16 },
    },
  },
};

// A rest day: the line says "Today: Rest day".
export const RestDay: Story = {
  args: { bodyMap: { ...goldenThursday, today: { kind: "rest", dayName: null } } },
};

// No routine, or nothing logged yet: the card says nothing about today.
export const NoPlanForToday: Story = {
  args: { bodyMap: { ...goldenThursday, today: { kind: "none", dayName: null } } },
};

// A fresh install: the figures at rest, the no-history line, and no Start button.
export const NoHistory: Story = {
  args: { bodyMap: { values: RESTING_HEAT, warmest: [], today: { kind: "none", dayName: null } } },
};
