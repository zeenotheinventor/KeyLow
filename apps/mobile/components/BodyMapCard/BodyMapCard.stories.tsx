import { View } from "react-native";

import { BodyMapCard } from "./BodyMapCard";
import { RESTING_HEAT } from "../DashboardScreen/DashboardBodyMapCard";

import type { Meta, StoryObj } from "@storybook/react-native";

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
    viewLabel: "Actual",
    subLine: "Now · Thu 15 Oct, 19:00",
    // The golden week at Thursday 19:00, as the `body · actual-heat` board draws it.
    values: {
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
    },
  },
} satisfies Meta<typeof BodyMapCard>;

export default meta;

type Story = StoryObj<typeof meta>;

// Actual heat now: the legs warmest, the arms and back light.
export const ActualHeat: Story = {};

// Nothing logged in the last 14 days: both figures at rest, and the line says why.
export const NothingLogged: Story = {
  args: { subLine: "Nothing logged in the last 14 days", values: RESTING_HEAT },
};
