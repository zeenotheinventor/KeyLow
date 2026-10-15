import { View } from "react-native";

import { Button } from "../Button";
import { TabBar } from "../TabBar";
import { Toast } from "./Toast";
import { ToastProvider, useToast } from "./ToastProvider";

import type { Meta, StoryObj } from "@storybook/react-native";

const meta = {
  title: "UI/Toast",
  component: Toast,
  decorators: [
    // The toast sits at the bottom of its parent, above the tab bar's height, so the parent fills the story.
    (Story) => (
      <View className="flex-1">
        <Story />
      </View>
    ),
  ],
  args: { message: "Entry deleted", bottomInset: 34 },
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

// As the diary boards draw it: above the tab bar and the safe area.
export const AboveTabBar: Story = {
  render: (args) => (
    <>
      <Toast {...args} />
      <View className="mt-auto">
        <TabBar
          activeKey="diary"
          addLabel="Find food"
          bottomInset={34}
          label="Main"
          platform="ios"
          tabs={[
            { key: "dashboard", label: "Dashboard", icon: "LayoutDashboard" },
            { key: "diary", label: "Diary", icon: "BookOpen" },
            { key: "recipes", label: "Recipes", icon: "ChefHat" },
            { key: "more", label: "More", icon: "Ellipsis" },
          ]}
          onAddPress={() => undefined}
          onSelect={() => undefined}
        />
      </View>
    </>
  ),
  args: { icon: "Trash2", actionLabel: "Undo", onAction: () => undefined },
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
