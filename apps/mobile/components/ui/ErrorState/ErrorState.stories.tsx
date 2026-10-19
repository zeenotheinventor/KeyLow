import { AUTH_SCREEN, SIGN_IN_LINK_INVALID, SEARCH_FAILED_MOBILE } from "@keylow/core/copy";
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

// The signing-in-link-error board: a plain button back to sign in, and 32 points at the sides.
export const WithAction: Story = {
  args: {
    title: SIGN_IN_LINK_INVALID.title,
    body: SIGN_IN_LINK_INVALID.body,
    action: { label: AUTH_SCREEN.backToSignIn, onPress: () => undefined },
    inset: "wide",
  },
};

// The training boards' error state, such as the history list's: a card among the other cards of a screen.
export const Card: Story = {
  args: {
    title: SEARCH_FAILED_MOBILE.title,
    body: SEARCH_FAILED_MOBILE.body,
    retry: { label: "Try again", onPress: () => undefined },
    variant: "card",
  },
};
