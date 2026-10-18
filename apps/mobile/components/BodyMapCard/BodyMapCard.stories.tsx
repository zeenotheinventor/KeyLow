import { View } from "react-native";

import { BodyMapCard } from "./BodyMapCard";
import { RESTING_HEAT } from "../DashboardScreen/DashboardBodyMapCard";

import type { Meta, StoryObj } from "@storybook/react-native";

// The golden week at Thursday 19:00, as the `body · actual-heat` board draws it. On today Projected shows
// what is logged, so the same steps stand for both views.
const goldenThursday = {
  ...RESTING_HEAT,
  chest_upper: 1,
  chest_lower: 1,
  delt_rear: 1,
  lats: 2,
  traps_mid: 1,
  lower_back: 2,
  biceps: 1,
  triceps: 1,
  glute_max: 3,
  quads: 3,
  hamstrings: 3,
  calves: 2,
};

const meta = {
  title: "BodyMap/BodyMapCard",
  component: BodyMapCard,
  decorators: [
    (Story) => (
      <View className="p-4">
        <Story />
      </View>
    ),
  ],
  args: {
    view: "actual",
    viewLabel: "Actual",
    subLine: "Now · Thu 15 Oct, 19:00",
    actualValues: goldenThursday,
    projectedValues: goldenThursday,
    toggleLabel: "Show projected",
    isToggleEnabled: true,
    onToggle: () => undefined,
    note: null,
  },
} satisfies Meta<typeof BodyMapCard>;

export default meta;

type Story = StoryObj<typeof meta>;

// Actual heat now: the legs warmest, the arms and back light, and the button that shows Projected.
export const ActualHeat: Story = {};

// Projected on today, as the `body · projected-today` board draws it: the same figures, and the line that says why.
export const ProjectedToday: Story = {
  args: {
    view: "projected",
    viewLabel: "Projected",
    toggleLabel: "Show actual",
    note: "Today, Projected shows what you have logged. A planned session counts from the next day, so pick a later day to see where your plan takes you.",
  },
};

// No routine, so there is no plan to project: the button is off and the line says why.
export const NoRoutine: Story = {
  args: { isToggleEnabled: false, note: "Projected needs a routine." },
};

// Nothing logged in the last 14 days: both figures at rest, and the line says why.
export const NothingLogged: Story = {
  args: {
    subLine: "Nothing logged in the last 14 days",
    actualValues: RESTING_HEAT,
    projectedValues: RESTING_HEAT,
  },
};
