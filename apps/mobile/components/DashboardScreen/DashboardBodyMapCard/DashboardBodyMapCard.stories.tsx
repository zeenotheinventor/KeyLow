import { RESTING_HEAT } from "@keylow/api-client";
import { View } from "react-native";

import { DashboardBodyMapCard } from "./DashboardBodyMapCard";

import type { DashboardHeatBodyMap, DashboardVolumeBodyMap } from "@keylow/api-client";
import type { Meta, StoryObj } from "@storybook/react-native";

// The golden week at Thursday 17:55, as the `dashboard · training-card` board draws it.
const goldenThursday: DashboardHeatBodyMap = {
  scale: "heat",
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

// The same Thursday under the Weekly volume chart: the actual sets of the week so far, Monday to Sunday.
const goldenThursdayVolume: DashboardVolumeBodyMap = {
  scale: "volume",
  values: {
    ...RESTING_HEAT,
    chest_upper: 2,
    chest_lower: 2,
    delt_side: 2,
    delt_rear: 1,
    lats: 3,
    traps_mid: 2,
    biceps: 1,
    triceps: 1,
  },
  mostTrained: [
    { muscle: "lats", weeklySets: 8 },
    { muscle: "delt_side", weeklySets: 6.5 },
    { muscle: "chest_upper", weeklySets: 6 },
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
  args: {
    bodyMap: {
      scale: "heat",
      values: RESTING_HEAT,
      warmest: [],
      today: { kind: "none", dayName: null },
    },
  },
};

// The Weekly volume chart: the volume legend from High to Not trained, and the three muscles with the most sets.
export const WeeklyVolume: Story = {
  args: { bodyMap: goldenThursdayVolume },
};

// The Weekly volume chart early on a Monday, before a set is logged this week.
export const WeeklyVolumeNothingThisWeek: Story = {
  args: {
    bodyMap: {
      scale: "volume",
      values: RESTING_HEAT,
      mostTrained: [],
      today: { kind: "planned", dayName: "Push", setCount: 18 },
    },
  },
};
