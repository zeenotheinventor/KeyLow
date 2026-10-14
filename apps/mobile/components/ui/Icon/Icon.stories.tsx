import { View } from "react-native";

import { Icon } from "./Icon";

import type { IconSizeName, IconTone } from "./types";
import type { Meta, StoryObj } from "@storybook/react-native";

const meta = {
  title: "UI/Icon",
  component: Icon,
  decorators: [
    (Story) => (
      <View className="flex-1 items-start justify-center gap-4 p-4">
        <Story />
      </View>
    ),
  ],
  args: { name: "Search" },
} satisfies Meta<typeof Icon>;

export default meta;

type Story = StoryObj<typeof meta>;

const sizes: IconSizeName[] = ["sm", "md", "lg", "xl"];
const tones: IconTone[] = ["primary", "secondary", "muted"];

export const Sizes: Story = {
  render: (args) => (
    <View className="flex-row items-end gap-4">
      {sizes.map((size) => (
        <Icon key={size} {...args} size={size} />
      ))}
    </View>
  ),
};

// Lime and the status colours are fills with an icon on top, so their tones are shown on their fills.
export const Tones: Story = {
  render: (args) => (
    <View className="flex-row items-center gap-4">
      {tones.map((tone) => (
        <Icon key={tone} {...args} tone={tone} />
      ))}
      <View className="rounded-small bg-accent p-2">
        <Icon {...args} tone="accent-foreground" />
      </View>
      <View className="rounded-small bg-danger p-2">
        <Icon {...args} tone="on-status" />
      </View>
    </View>
  ),
};

export const Labelled: Story = { args: { name: "ScanBarcode", size: "lg", label: "Scan barcode" } };

export const Names: Story = {
  render: (args) => (
    <View className="flex-row gap-4">
      <Icon {...args} name="Plus" />
      <Icon {...args} name="ScanBarcode" />
      <Icon {...args} name="Search" />
      <Icon {...args} name="X" />
    </View>
  ),
};
