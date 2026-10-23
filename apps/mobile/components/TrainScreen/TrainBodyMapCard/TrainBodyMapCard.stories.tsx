import { View } from "react-native";

import { TrainBodyMapCard } from "./TrainBodyMapCard";
import { RESTING_HEAT } from "../../DashboardScreen/DashboardBodyMapCard";

import type { Meta, StoryObj } from "@storybook/react-native";

// The golden week at Thursday 17:55, as the `train · today` board draws it.
const goldenThursday = {
  ...RESTING_HEAT,
  chest_upper: 1,
  chest_lower: 1,
  delt_rear: 1,
  lats: 2,
  traps_mid: 1,
  biceps: 1,
  triceps: 1,
};

const meta = {
  title: "Train/TrainBodyMapCard",
  component: TrainBodyMapCard,
  decorators: [
    (Story) => (
      <View className="flex-1 justify-center p-4">
        <Story />
      </View>
    ),
  ],
  args: {
    view: "actual",
    values: goldenThursday,
    viewLabel: "Actual",
    subLine: "Now · Thu 15 Oct, 17:55",
    toggleLabel: "Show projected",
    isToggleEnabled: true,
    note: null,
    onToggle: () => undefined,
    onOpenBodyMap: () => undefined,
  },
} satisfies Meta<typeof TrainBodyMapCard>;

export default meta;

type Story = StoryObj<typeof meta>;

// Actual heat now, with Show projected and the chevron that opens the body map.
export const Actual: Story = {};

// The Projected picture, whose button reads Show actual.
export const Projected: Story = {
  args: { view: "projected", viewLabel: "Projected", toggleLabel: "Show actual" },
};

// No routine: Projected is off, and the line says why.
export const NoRoutine: Story = {
  args: { isToggleEnabled: false, note: "Projected needs a routine." },
};

// Nothing logged in the last 14 days: the figures at rest.
export const NothingLogged: Story = {
  args: { values: RESTING_HEAT, subLine: "Nothing logged in the last 14 days" },
};

// The phone is offline: what it saved, and when.
export const Offline: Story = { args: { subLine: "Saved · Thu 15 Oct, 17:52" } };
