import { View } from "react-native";

import { Button } from "./Button";

import type { ButtonVariant } from "./types";
import type { Meta, StoryObj } from "@storybook/react-native";

const meta = {
  title: "UI/Button",
  component: Button,
  decorators: [
    (Story) => (
      <View className="flex-1 items-start justify-center gap-4 p-4">
        <Story />
      </View>
    ),
  ],
  args: { children: "Add entry" },
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

const variants: ButtonVariant[] = ["primary", "secondary", "destructive", "ghost"];

export const Primary: Story = { args: { variant: "primary" } };

export const Secondary: Story = { args: { variant: "secondary", children: "Scan barcode" } };

export const Destructive: Story = { args: { variant: "destructive", children: "Delete account" } };

export const Ghost: Story = { args: { variant: "ghost", children: "Add portion" } };

// The minor action inside a card, such as removing a portion: 36 high, in the secondary text colour.
export const Small: Story = {
  args: { variant: "ghost", size: "sm", quiet: true, icon: "Trash2", children: "Remove" },
};

export const Large: Story = { args: { size: "lg", children: "Create food" } };

export const WithIcon: Story = {
  args: { variant: "secondary", icon: "Plus", children: "Create a food" },
};

export const FullWidth: Story = {
  decorators: [
    (Story) => (
      <View className="w-full">
        <Story />
      </View>
    ),
  ],
  args: { variant: "secondary", fullWidth: true, children: "Scan barcode" },
};

export const Disabled: Story = {
  render: (args) => (
    <>
      {variants.map((variant) => (
        <Button key={variant} {...args} disabled variant={variant} />
      ))}
    </>
  ),
};

export const Loading: Story = {
  render: (args) => (
    <>
      {variants.map((variant) => (
        <Button key={variant} {...args} loading variant={variant} />
      ))}
    </>
  ),
};
