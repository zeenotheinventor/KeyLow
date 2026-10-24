import { View } from "react-native";

import { Body3D } from "./Body3D";

import type { Meta, StoryObj } from "@storybook/react-native";

const meta = {
  title: "UI/Body3D",
  component: Body3D,
  decorators: [
    (Story) => (
      <View className="flex-1 items-center justify-center p-4">
        <Story />
      </View>
    ),
  ],
  // The size of the body map's figure. The scheme comes from the theme toolbar, so the story shows in
  // dark and in light.
  args: { label: "Body, male, 3D", w: 120 },
} satisfies Meta<typeof Body3D>;

export default meta;

type Story = StoryObj<typeof meta>;

// The male body with every muscle at rest, seen through a faint skin. The theme toolbar shows it in light and dark.
export const AtRest: Story = {};

export const Wide: Story = { args: { w: 240 } };
