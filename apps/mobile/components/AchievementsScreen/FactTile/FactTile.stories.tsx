import { View } from "react-native";

import { FactTile } from "./FactTile";

import type { Meta, StoryObj } from "@storybook/react-native";

const meta = {
  title: "Achievements/FactTile",
  component: FactTile,
  decorators: [
    (Story) => (
      <View className="flex-row p-5">
        <Story />
      </View>
    ),
  ],
} satisfies Meta<typeof FactTile>;

export default meta;

type Story = StoryObj<typeof meta>;

export const EarnedOn: Story = { args: { label: "Earned", value: "6 November 2026" } };

export const Points: Story = { args: { label: "Points", value: "+25" } };
