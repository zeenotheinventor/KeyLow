import { View } from "react-native";

import { storyBadge } from "../storyFixtures";
import { BadgeTile } from "./BadgeTile";

import type { Meta, StoryObj } from "@storybook/react-native";

const meta = {
  title: "Achievements/BadgeTile",
  component: BadgeTile,
  decorators: [
    (Story) => (
      <View className="w-1/4 p-5">
        <Story />
      </View>
    ),
  ],
  args: {
    onPress: () => undefined,
  },
} satisfies Meta<typeof BadgeTile>;

export default meta;

type Story = StoryObj<typeof meta>;

// An earned badge shows its tier under the name.
export const Earned: Story = { args: { badge: storyBadge("fortnight") } };

// A locked badge shows its progress bar and line.
export const Locked: Story = { args: { badge: storyBadge("month-strong") } };

// A hidden badge shows ??? and gives nothing away.
export const Hidden: Story = { args: { badge: storyBadge("midnight-snack") } };
