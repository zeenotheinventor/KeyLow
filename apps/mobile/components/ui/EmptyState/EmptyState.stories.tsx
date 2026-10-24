import {
  BODY_MAP,
  FOOD_NOT_FOUND,
  PROGRAM_NO_PROGRAM,
  RECIPES_EMPTY,
  RECIPES_LIBRARY,
  RECIPES_SEARCH_EMPTY,
  SEARCH_EMPTY,
  WEIGHT_EMPTY,
  YOUR_FOODS_EMPTY,
} from "@keylow/core/copy";
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

// The food detail's not-found board: the words are 32 points from the sides.
export const Wide: Story = {
  args: { icon: "SearchX", title: FOOD_NOT_FOUND.title, body: FOOD_NOT_FOUND.body, inset: "wide" },
};

// The recipes tab before the first recipe: its one action is primary.
export const PrimaryAction: Story = {
  args: {
    icon: "ChefHat",
    title: RECIPES_EMPTY.title,
    body: RECIPES_EMPTY.body,
    action: {
      label: RECIPES_LIBRARY.newRecipe,
      icon: "Plus",
      variant: "primary",
      onPress: () => undefined,
    },
  },
};

// The recipes tab's no-matches state while offline: the action cannot work without a connection.
export const DisabledAction: Story = {
  args: {
    icon: "SearchX",
    title: RECIPES_SEARCH_EMPTY.title,
    body: RECIPES_SEARCH_EMPTY.body,
    action: {
      label: RECIPES_LIBRARY.newRecipe,
      icon: "Plus",
      disabled: true,
      onPress: () => undefined,
    },
  },
};

// The empty Weight board: Add weigh-in, and under it a secondary way in, Connect Health Connect.
export const SecondaryAction: Story = {
  args: {
    icon: "Weight",
    title: WEIGHT_EMPTY.title,
    body: WEIGHT_EMPTY.body,
    action: { label: WEIGHT_EMPTY.addWeighIn, variant: "primary", onPress: () => undefined },
    secondaryAction: { label: WEIGHT_EMPTY.connectHealth, icon: "Heart", onPress: () => undefined },
  },
};

// The Programme screen's no-program board: three lines of what a programme does under the body, and the one action
// large and the full width of the view.
export const WithPoints: Story = {
  args: {
    icon: "ChartLine",
    title: PROGRAM_NO_PROGRAM.title,
    body: PROGRAM_NO_PROGRAM.body,
    points: [
      { icon: "Calculator", text: PROGRAM_NO_PROGRAM.points[0] },
      { icon: "Scale", text: PROGRAM_NO_PROGRAM.points[1] },
      { icon: "Target", text: PROGRAM_NO_PROGRAM.points[2] },
    ],
    action: {
      label: PROGRAM_NO_PROGRAM.startLabel,
      variant: "primary",
      onPress: () => undefined,
    },
  },
};

// The training boards' empty state, as the body map draws it: a card with no tile, in among the other cards.
// Its Start a session button waits for the Train tab, so the story leaves it out too.
export const Card: Story = {
  args: {
    variant: "card",
    title: BODY_MAP.emptyState.title,
    body: BODY_MAP.emptyState.body,
  },
  decorators: [
    (Story) => (
      <View className="p-4">
        <Story />
      </View>
    ),
  ],
};
