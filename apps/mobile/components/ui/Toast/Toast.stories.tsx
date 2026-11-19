import { View } from "react-native";

import { AchievementBadge } from "../AchievementBadge";
import { Button } from "../Button";
import { Text } from "../Text";
import { Toast } from "./Toast";
import { ToastProvider, useToast } from "./ToastProvider";

import type { Meta, StoryObj } from "@storybook/react-native";

const meta = {
  title: "UI/Toast",
  component: Toast,
  decorators: [
    // The toast sits at the top of its parent, under the safe area, so the parent fills the story.
    (Story) => (
      <View className="flex-1">
        <Story />
      </View>
    ),
  ],
  args: { message: "Entry deleted", topInset: 59 },
} satisfies Meta<typeof Toast>;

export default meta;

type Story = StoryObj<typeof meta>;

// The deleted toast board: a trash icon and the one Undo action.
export const WithUndo: Story = {
  args: { icon: "Trash2", actionLabel: "Undo", onAction: () => undefined },
};

// The saved toast board: a success check and no action.
export const Success: Story = {
  args: { message: "Added to Lunch", icon: "Check", tone: "success" },
};

export const Warning: Story = {
  args: { message: "Saved on this phone only", icon: "TriangleAlert", tone: "warning" },
};

export const Danger: Story = {
  args: { message: "Could not delete the entry", icon: "CircleAlert", tone: "danger" },
};

export const MessageOnly: Story = {};

export const LongMessage: Story = {
  args: {
    message: "Entry deleted from Breakfast, and the day's totals have been worked out again",
    icon: "Trash2",
    actionLabel: "Undo",
    onAction: () => undefined,
  },
};

// The updated toast: the success colour as the fill, with the ink for it on the words and the icon.
export const SuccessFilled: Story = {
  args: { message: "Ki-Lo has been updated!", icon: "CircleCheck", variant: "success-filled" },
};

// The favourite toasts sit just under the header, 64 points under the safe area for the food detail's stack header,
// so the heart that was just tapped stays in view. No action: tapping the heart again is the undo.
export const FavouriteAdded: Story = {
  args: {
    message: "Added to favourites",
    icon: "Heart",
    isIconFilled: true,
    tone: "accent",
    topOffset: 64,
  },
};

export const FavouriteRemoved: Story = {
  args: { message: "Removed from favourites", icon: "Heart", topOffset: 64 },
};

// Board 3, the unlock toast for one badge: the medal at 44, how it was earned with the points, and View.
export const AchievementSingle: Story = {
  args: {
    variant: "achievement",
    message: "Badge earned: Hat Trick",
    description: "3-day daily streak. +10 points",
    actionLabel: "View",
    onAction: () => undefined,
    bottomInset: 34,
  },
  // A medal is an element, which a story's args may not hold, so the story draws it.
  render: (args) => (
    <Toast {...args} medal={<AchievementBadge decorative id="hat-trick" size={44} />} />
  ),
};

// Board 3, the grouped toast: a count in place of the medal, the names, and the freeze and level chips.
export const AchievementGrouped: Story = {
  args: {
    variant: "achievement",
    message: "3 badges earned",
    description: "Fortnight, Notebook and Bullseye. +45 points",
    chips: [
      { label: "+1 freeze", tone: "protein" },
      { label: "You reached Sapling", tone: "accent" },
    ],
    actionLabel: "View",
    onAction: () => undefined,
    bottomInset: 34,
  },
  render: (args) => (
    <Toast
      {...args}
      medal={
        <View className="h-11 w-11 items-center justify-center rounded-full border-2 border-text-secondary">
          <Text tone="secondary" variant="body-strong">
            3
          </Text>
        </View>
      }
    />
  ),
};

function ToastButtons() {
  const { show } = useToast();
  return (
    <View className="flex-1 items-start justify-center gap-4 p-4">
      <Button
        onPress={() => {
          show({ message: "Entry deleted", icon: "Trash2", actionLabel: "Undo" });
        }}
      >
        Delete an entry
      </Button>
      <Button
        variant="secondary"
        onPress={() => {
          show({ message: "Added to Lunch", icon: "Check", tone: "success" });
        }}
      >
        Add to Lunch
      </Button>
      <Button
        variant="secondary"
        onPress={() => {
          show({
            message: "Ki-Lo has been updated!",
            icon: "CircleCheck",
            variant: "success-filled",
          });
        }}
      >
        Show the updated toast
      </Button>
    </View>
  );
}

// The provider at work: one toast at a time, a new one replacing the current one, each closing after 5 seconds.
export const WithProvider: Story = {
  render: () => (
    <ToastProvider>
      <ToastButtons />
    </ToastProvider>
  ),
};
