import { View } from "react-native";

import { storyBeginnerOverview, storyOverview } from "../storyFixtures";
import { LevelCard } from "./LevelCard";

import type { Meta, StoryObj } from "@storybook/react-native";

const meta = {
  title: "Achievements/LevelCard",
  component: LevelCard,
  decorators: [
    (Story) => (
      <View className="flex-1 p-5">
        <Story />
      </View>
    ),
  ],
} satisfies Meta<typeof LevelCard>;

export default meta;

type Story = StoryObj<typeof meta>;

// Board 1: level 6, Sapling, 1,180 points and 220 to level 7.
export const Default: Story = { args: { level: storyOverview.level } };

// Nothing earned yet: level 0, a Sprout, with the whole of the first 50 points to go.
export const Beginning: Story = { args: { level: storyBeginnerOverview.level } };
