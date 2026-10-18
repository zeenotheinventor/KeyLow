import { View } from "react-native";

import { ViewLabel } from "./ViewLabel";

import type { Meta, StoryObj } from "@storybook/react-native";

const meta = {
  title: "BodyMap/ViewLabel",
  component: ViewLabel,
  decorators: [
    (Story) => (
      <View className="p-4">
        <Story />
      </View>
    ),
  ],
  args: { label: "Actual", subLine: "Now · Thu 15 Oct, 19:00" },
} satisfies Meta<typeof ViewLabel>;

export default meta;

type Story = StoryObj<typeof meta>;

// Actual heat now, as the body map board draws it.
export const ActualNow: Story = {};

// Nothing logged in the last 14 days, so the line says why there is nothing to show.
export const NothingLogged: Story = {
  args: { subLine: "Nothing logged in the last 14 days" },
};
