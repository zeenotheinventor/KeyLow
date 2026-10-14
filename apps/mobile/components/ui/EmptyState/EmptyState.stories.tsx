import { SEARCH_EMPTY, YOUR_FOODS_EMPTY } from "@keylow/core/copy";
import { View } from "react-native";

import { EmptyState } from "./EmptyState";

import type { Meta, StoryObj } from "@storybook/react-native";

const meta = {
  title: "UI/EmptyState",
  component: EmptyState,
  decorators: [
    (Story) => (
      // The view fills its parent, as the boards draw it in the body of the sheet.
      <View className="flex-1">
        <Story />
      </View>
    ),
  ],
} satisfies Meta<typeof EmptyState>;

export default meta;

type Story = StoryObj<typeof meta>;

// The empty and empty-off-error boards: a search that found nothing.
export const NoResults: Story = {
  args: {
    icon: "SearchX",
    title: SEARCH_EMPTY.title,
    body: SEARCH_EMPTY.body,
    action: { label: SEARCH_EMPTY.action, icon: "Plus", onPress: () => undefined },
  },
};

// The your-foods-empty board: the user has no foods of their own yet.
export const YourFoodsEmpty: Story = {
  args: {
    icon: "Apple",
    title: YOUR_FOODS_EMPTY.title,
    body: YOUR_FOODS_EMPTY.body,
    action: { label: YOUR_FOODS_EMPTY.action, icon: "Plus", onPress: () => undefined },
  },
};

// A view with nothing to do about it has no action.
export const WithoutAction: Story = {
  args: { icon: "SearchX", title: SEARCH_EMPTY.title, body: SEARCH_EMPTY.body },
};
