import { View } from "react-native";

import { Text } from "../Text";
import { PressableSurface } from "./PressableSurface";

import type { Meta, StoryObj } from "@storybook/react-native";

const surfaceClassName = "rounded-medium border border-border bg-surface-raised px-4 py-3";

const meta = {
  title: "UI/PressableSurface",
  component: PressableSurface,
  decorators: [
    (Story) => (
      <View className="flex-1 items-start justify-center gap-4 p-4">
        <Story />
      </View>
    ),
  ],
  // The contents are drawn by `render`, because a React element in the args is not serializable and Storybook warns of it.
  render: (args) => (
    <PressableSurface {...args}>
      <Text>Savoury Stock Cube</Text>
    </PressableSurface>
  ),
  args: { className: surfaceClassName, label: "Open food", children: null },
} satisfies Meta<typeof PressableSurface>;

export default meta;

type Story = StoryObj<typeof meta>;

// Hold it down on a device to see the press: it compresses to 0.96 and the overlay darkens it.
export const Default: Story = {};

export const Disabled: Story = {
  args: { disabled: true, className: `${surfaceClassName} opacity-40` },
};

export const Busy: Story = { args: { busy: true } };
