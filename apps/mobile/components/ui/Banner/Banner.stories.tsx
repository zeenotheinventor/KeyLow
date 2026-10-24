import {
  ADD_PRODUCT_FAILED,
  FOOD_REVIEW_BANNER,
  NO_TARGET_BANNER,
  OFFLINE_BANNER,
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

// The diary and dashboard offline boards: the quiet notice, 12 points all round, with the sentence in
// regular body text and no action.
export const Offline: Story = {
  args: {
    variant: "offline",
    title: OFFLINE_BANNER.title,
    body: OFFLINE_BANNER.body,
  },
};

// The off-error and empty-off-error boards: Open Food Facts could not be searched, and the rest still works.
// Info without an action.
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

// The no-target boards on the diary and the dashboard: the quiet notice with its action under the words,
// in strong body text, underlined, in the accent ink (lime in dark, the primary text colour in light).
export const InfoWithAction: Story = {
  args: {
    variant: "info",
    title: NO_TARGET_BANNER.title,
    body: NO_TARGET_BANNER.body,
    action: { label: NO_TARGET_BANNER.action, onPress: () => undefined },
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

// The sign-in-error board: one sentence and no title, in regular body text, which only the `sentence` prop draws.
export const Sentence: Story = {
  args: {
    variant: "error",
    title: "Email or password is not right. Check them and try again.",
    body: undefined,
    sentence: true,
  },
};

// The save-partial board: the food saved and its portions did not, so the warning notice is announced as
// an alert, because the person is waiting on the result.
export const PartialSave: Story = {
  args: {
    variant: "review",
    announce: true,
    title: "Portions not saved",
    body: "Your food was saved but its portions were not. Save again to add them.",
  },
};

// An element in a story's args breaks the on-device story index (KEY-220), so the slot is drawn in render.
// A stand-in for what a screen draws under the words, here a bar as the trend explainer's board has it.
function Bar() {
  return (
    <View className="h-[6px] overflow-hidden rounded-[3px] bg-surface-raised">
      <View className="h-[6px] w-[43%] bg-warning" />
    </View>
  );
}

// The children slot: anything the screen draws under the words, with the icon kept.
export const WithChildren: Story = {
  args: {
    variant: "review",
    title: "Your trend is settling: 3 of 7 weigh-ins",
  },
  render: (args) => (
    <Banner {...args}>
      <Bar />
    </Banner>
  ),
};

// The trend explainer's settling board: the warning notice with no leading icon and a bar under its words.
export const WithoutIcon: Story = {
  args: {
    variant: "review",
    hasIcon: false,
    title: "Your trend is settling: 3 of 7 weigh-ins",
  },
  render: (args) => (
    <Banner {...args}>
      <Bar />
    </Banner>
  ),
};

// The trend explainer's settling board: the warning notice at the compact size, with no border, 12 points all
// round, a 14 over 20 title, no icon and a bar under it.
export const Compact: Story = {
  args: {
    variant: "review",
    size: "compact",
    hasIcon: false,
    title: "Your trend is settling: 3 of 7 weigh-ins",
  },
  render: (args) => (
    <Banner {...args}>
      <Bar />
    </Banner>
  ),
};
