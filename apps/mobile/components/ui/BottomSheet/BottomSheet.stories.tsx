import { useState } from "react";
import { View } from "react-native";

import { Button } from "../Button";
import { Text } from "../Text";
import { BottomSheet } from "./BottomSheet";

import type { Meta, StoryObj } from "@storybook/react-native";

const meta = {
  title: "UI/BottomSheet",
  component: BottomSheet,
  decorators: [
    // The sheet covers its parent, as the design system card does inside its frame. Its drag needs a
    // gesture handler root view, which the story smoke test cannot render in Jest, so the app's root
    // layout brings it.
    (Story) => (
      <View className="flex-1 p-4">
        <Text variant="h1">Today</Text>
        <Story />
      </View>
    ),
  ],
  args: { open: true, onClose: () => undefined },
} satisfies Meta<typeof BottomSheet>;

export default meta;

type Story = StoryObj<typeof meta>;

const weekDays = ["Mon 12", "Tue 13", "Wed 14", "Thu 15", "Fri 16", "Sat 17", "Sun 18"];

// An element in a story's args breaks the on-device story index (KEY-220), so the contents are drawn in render.

// The design system card: a title and a task above the screen.
export const Default: Story = {
  args: { title: "Log weight", children: null },
  render: (args) => (
    <BottomSheet {...args}>
      <Text tone="secondary">Weigh yourself in the morning for a steadier trend.</Text>
    </BottomSheet>
  ),
};

// The date picker board has no title of its own: its contents carry the month.
export const WithoutTitle: Story = {
  args: { children: null },
  render: (args) => (
    <BottomSheet {...args}>
      <Text variant="h2">October 2026</Text>
    </BottomSheet>
  ),
};

// The week sheet board: a title over a list that takes most of the screen.
export const Tall: Story = {
  args: { title: "This week", children: null },
  render: (args) => (
    <BottomSheet {...args}>
      <View className="gap-4">
        {weekDays.map((day) => (
          <Text key={day} variant="body-strong">
            {day}
          </Text>
        ))}
        <Text tone="secondary" variant="caption">
          Incomplete days count from Monday to today.
        </Text>
      </View>
    </BottomSheet>
  ),
};

export const Closed: Story = { args: { open: false, title: "Log weight" } };

function OpenAndClose() {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <Button
        onPress={() => {
          setIsOpen(true);
        }}
      >
        Log weight
      </Button>
      <BottomSheet
        open={isOpen}
        title="Log weight"
        onClose={() => {
          setIsOpen(false);
        }}
      >
        <Text tone="secondary">Press the dim, drag down or press back to close.</Text>
      </BottomSheet>
    </>
  );
}

// Opens from a button and closes from the dim, a drag down or the back button.
export const Interactive: Story = { render: () => <OpenAndClose /> };
