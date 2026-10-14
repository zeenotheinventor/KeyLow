import {
  ADD_PRODUCT_FAILED,
  FOOD_REVIEW_BANNER,
  OPEN_FOOD_FACTS_BUSY,
  OPEN_FOOD_FACTS_SEARCH_FAILED,
  describeBarcodeRateLimit,
} from "@keylow/core/copy";
import { View } from "react-native";

import { Banner } from "./Banner";

import type { Meta, StoryObj } from "@storybook/react-native";

const meta = {
  title: "UI/Banner",
  component: Banner,
  decorators: [
    (Story) => (
      <View className="flex-1 justify-center p-4">
        <Story />
      </View>
    ),
  ],
} satisfies Meta<typeof Banner>;

export default meta;

type Story = StoryObj<typeof meta>;

// The food detail's missing-values boards: warning-toned, with one action.
export const Review: Story = {
  args: {
    variant: "review",
    title: FOOD_REVIEW_BANNER.title,
    body: "Energy and carbohydrate are not given. Fill them in to save your own copy of this food.",
    action: { label: FOOD_REVIEW_BANNER.action, onPress: () => undefined },
  },
};

// The design system card's quiet notice for a view that is showing saved data.
export const Offline: Story = {
  args: {
    variant: "offline",
    title: "Offline",
    body: "Showing saved data. Changes will not save.",
  },
};

// The off-error and empty-off-error boards: Open Food Facts could not be searched, and the rest still works.
export const Info: Story = {
  args: {
    variant: "info",
    icon: "CloudOff",
    title: OPEN_FOOD_FACTS_SEARCH_FAILED.title,
    body: OPEN_FOOD_FACTS_SEARCH_FAILED.body,
  },
};

// The rate-limited board: the same quiet notice, with a clock.
export const InfoBusy: Story = {
  args: {
    variant: "info",
    icon: "Clock",
    title: OPEN_FOOD_FACTS_BUSY,
    body: describeBarcodeRateLimit(30),
  },
};

// The quiet variants take an action in secondary text, as the design system card has it.
export const InfoWithAction: Story = {
  args: {
    variant: "info",
    icon: "CloudOff",
    title: OPEN_FOOD_FACTS_SEARCH_FAILED.title,
    body: OPEN_FOOD_FACTS_SEARCH_FAILED.body,
    action: { label: "Try again", onPress: () => undefined },
  },
};

// The add-product-error board: a failed add, in the design system's proposed error tone.
export const AddFailed: Story = {
  args: {
    variant: "error",
    title: ADD_PRODUCT_FAILED.title,
    body: ADD_PRODUCT_FAILED.body,
  },
};
