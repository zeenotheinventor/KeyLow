import { View } from "react-native";

import { SheetHeader } from "./SheetHeader";
import { Button } from "../Button";
import { PlateChip } from "../PlateChip";

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

const editAndMore = [
  { icon: "Pencil", label: "Edit Chicken and rice", onPress: () => undefined },
  { icon: "Ellipsis", label: "More", onPress: () => undefined },
] as const;

// The recipe view: Back, the recipe's name and two controls. The component board draws the raised
// controls and the large title of the sheet header.
export const TwoControls: Story = {
  args: { title: "Chicken and rice", leading: back, trailing: editAndMore },
};

export const TwoControlsStack: Story = {
  args: { variant: "stack", title: "Chicken and rice", leading: back, trailing: editAndMore },
};

// Offline, the recipe view keeps both controls and dims them.
export const TwoControlsDisabled: Story = {
  args: {
    title: "Chicken and rice",
    leading: back,
    trailing: [
      { ...editAndMore[0], disabled: true },
      { ...editAndMore[1], disabled: true },
    ],
  },
};

// The routine editor: Cancel editing, the title, More and then Save. A control and a slot together draw the
// control first. No board draws the More control. The slot is a React element, which a story's args cannot
// hold, so the story renders the header itself.
export const ControlAndSlot: Story = {
  args: {
    title: "Edit routine",
    leading: { icon: "ChevronLeft", label: "Cancel editing", onPress: () => undefined },
    trailing: { icon: "Ellipsis", label: "More for this routine", onPress: () => undefined },
  },
  render: (args) => <SheetHeader {...args} trailingSlot={<Button size="sm">Save</Button>} />,
};

// The title stays on one line, truncated, in the space the controls leave.
export const LongTitle: Story = {
  args: {
    title: "Slow cooked chicken and rice with spinach and a very long name",
    leading: back,
    trailing: editAndMore,
  },
};

// The setup's first step: no Back and no Close. The empty 44 point slot keeps the title in the middle, and
// the subtitle carries the step.
export const WithoutLeading: Story = {
  args: { title: "About you", subtitle: "Step 1 of 8" },
};

// Recalculate's first step: Close at the right only.
export const WithoutLeadingWithClose: Story = {
  args: { title: "About you", subtitle: "Step 1 of 8", trailing: close },
};

// The log search with foods on the plate: the chip at the right, in a slot as wide as the left one, so the title stays centred.
export const WithPlateChip: Story = {
  args: { title: "Log food", leading: close, hasWideSlots: true },
  render: (args) => (
    <SheetHeader {...args} trailingSlot={<PlateChip count={4} onPress={() => undefined} />} />
  ),
};
