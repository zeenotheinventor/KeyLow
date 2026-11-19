import { View } from "react-native";

import { storyBeginnerOverview, storyOverview } from "../storyFixtures";
import { StatTiles } from "./StatTiles";

import type { Meta, StoryObj } from "@storybook/react-native";

const meta = {
  title: "Achievements/StatTiles",
  component: StatTiles,
  decorators: [
    (Story) => (
      <View className="flex-1 p-5">
        <Story />
      </View>
    ),
  ],
} satisfies Meta<typeof StatTiles>;

export default meta;

type Story = StoryObj<typeof meta>;

// Board 1: a 12 day streak, 3 freezes and 41 of 130 badges.
export const Default: Story = { args: { tiles: storyOverview.tiles } };

// A new person: no streak yet and one freeze, which reads in the singular.
export const Beginning: Story = { args: { tiles: storyBeginnerOverview.tiles } };
