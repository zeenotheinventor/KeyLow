import { View } from "react-native";

import { IconButton } from "./IconButton";

import type { Meta, StoryObj } from "@storybook/react-native";

const meta = {
  title: "UI/IconButton",
  component: IconButton,
  decorators: [
    (Story) => (
      <View className="flex-1 items-start justify-center gap-4 p-4">
        <Story />
      </View>
    ),
  ],
  args: { icon: "X", label: "Close" },
} satisfies Meta<typeof IconButton>;

export default meta;

type Story = StoryObj<typeof meta>;

// The sheet header's close and create controls.
export const Secondary: Story = { args: { variant: "secondary" } };

// The scan control inside the search field: 36 points to look at, 44 to touch.
export const Ghost: Story = {
  args: { variant: "ghost", size: "sm", icon: "ScanBarcode", label: "Scan barcode" },
};

// The quiet plus on a food row: a 32 point ring, reached out to 44 points to touch.
export const Ring: Story = {
  args: { variant: "ring", icon: "Plus", label: "Add Banana, 1 medium (100 g)" },
};

// The X on an ingredient row: a ghost control with the glyph in secondary text.
export const Quiet: Story = {
  args: { variant: "ghost", tone: "secondary", label: "Remove Onions, raw" },
};

export const Disabled: Story = {
  render: (args) => (
    <View className="flex-row items-center gap-4">
      <IconButton {...args} disabled variant="secondary" />
      <IconButton {...args} disabled icon="ScanBarcode" size="sm" variant="ghost" />
      <IconButton {...args} disabled icon="Plus" variant="ring" />
    </View>
  ),
};
