import { View } from "react-native";

import { Text } from "../Text";
import { ConfirmDialog } from "./ConfirmDialog";

import type { Meta, StoryObj } from "@storybook/react-native";

const meta = {
  title: "UI/ConfirmDialog",
  component: ConfirmDialog,
  decorators: [
    // The dialog covers the screen behind it, as the boards draw it over their screen.
    (Story) => (
      <View className="flex-1 p-4">
        <Text variant="h1">Today</Text>
        <Story />
      </View>
    ),
  ],
  args: {
    open: true,
    title: "Discard this session?",
    body: "The 8 sets you logged in Legs today are removed from your history and your body map. This cannot be undone.",
    confirmLabel: "Discard session",
    cancelLabel: "Keep logging",
    tone: "destructive",
    onConfirm: () => undefined,
    onCancel: () => undefined,
  },
} satisfies Meta<typeof ConfirmDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

// The session discard board: the answer removes something, so it is written in the danger colour and the way back is the main button.
export const Destructive: Story = {};

// The routines set active board: the answer only changes what is current, so it is the main button.
export const Primary: Story = {
  args: {
    tone: "primary",
    title: "Make Upper Lower active?",
    body: "It plans from today, Thursday 15 October. Push Pull Legs stays saved, and the sessions you logged keep their days.",
    confirmLabel: "Make active",
    cancelLabel: "Cancel",
  },
};

// The answer is being carried out: the confirm button shows a spinner and ignores presses.
export const Busy: Story = { args: { busy: true } };

// A title and a sentence that wrap onto several lines, as they do at the largest text sizes the device allows.
// The card takes its height from its contents and stays centred.
export const LongTitle: Story = {
  args: {
    title: "Delete this session from your history and your body map?",
    body: "The 8 sets you logged in Legs on Thursday 15 October are removed from your history and your body map, and your last performance for each exercise goes back to the session before it. This cannot be undone.",
    confirmLabel: "Delete session",
    cancelLabel: "Keep session",
  },
};

export const Closed: Story = { args: { open: false } };
