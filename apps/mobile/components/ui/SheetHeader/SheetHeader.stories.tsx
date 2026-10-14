import { View } from "react-native";

import { SheetHeader } from "./SheetHeader";

import type { Meta, StoryObj } from "@storybook/react-native";

const meta = {
  title: "UI/SheetHeader",
  component: SheetHeader,
  decorators: [
    (Story) => (
      // The screen gives the top inset, which the boards draw as 44 points of the status bar.
      <View className="flex-1 pt-[44px]">
        <Story />
      </View>
    ),
  ],
  args: { title: "Find food" },
} satisfies Meta<typeof SheetHeader>;

export default meta;

type Story = StoryObj<typeof meta>;

const close = { icon: "X", label: "Close", onPress: () => undefined } as const;
const back = { icon: "ChevronLeft", label: "Back", onPress: () => undefined } as const;

// The search sheet: close at the left, create at the right.
export const Search: Story = {
  args: {
    title: "Find food",
    leading: close,
    trailing: { icon: "Plus", label: "Create a food", onPress: () => undefined },
  },
};

// The food detail has its own heading, so "Food" is not one.
export const Detail: Story = {
  args: { variant: "stack", title: "Food", leading: back, trailing: close, isTitleHeading: false },
};

export const Form: Story = {
  args: { variant: "stack", title: "New food", leading: back, trailing: close },
};

export const Scanner: Story = {
  args: {
    variant: "stack",
    title: "Scan barcode",
    leading: { ...back, label: "Back to search" },
    trailing: close,
  },
};
