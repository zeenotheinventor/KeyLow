import { SEARCH_FAILED_MOBILE } from "@keylow/core/copy";
import { View } from "react-native";

import { ErrorState } from "./ErrorState";

import type { Meta, StoryObj } from "@storybook/react-native";

const meta = {
  title: "UI/ErrorState",
  component: ErrorState,
  decorators: [
    (Story) => (
      // The view fills its parent, as the boards draw it in the body of the sheet.
      <View className="flex-1">
        <Story />
      </View>
    ),
  ],
} satisfies Meta<typeof ErrorState>;

export default meta;

type Story = StoryObj<typeof meta>;

// The local-error board draws no retry, because the search runs again when the query changes.
export const SearchFailed: Story = {
  args: { title: SEARCH_FAILED_MOBILE.title, body: SEARCH_FAILED_MOBILE.body },
};

// A failure that does not retry itself offers a way to.
export const WithRetry: Story = {
  args: {
    title: SEARCH_FAILED_MOBILE.title,
    body: SEARCH_FAILED_MOBILE.body,
    retry: { label: "Try again", onPress: () => undefined },
  },
};
