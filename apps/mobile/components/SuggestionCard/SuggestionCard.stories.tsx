import { View } from "react-native";

import { thursdayOffer as offer } from "./storyStates";
import { SuggestionCard } from "./SuggestionCard";

import type { Meta, StoryObj } from "@storybook/react-native";

const meta = {
  title: "Train/SuggestionCard",
  component: SuggestionCard,
  decorators: [
    (Story) => (
      <View className="p-4">
        <Story />
      </View>
    ),
  ],
  args: {
    onDismiss: () => undefined,
    onSetGoal: () => undefined,
  },
} satisfies Meta<typeof SuggestionCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Offer: Story = { args: { state: offer } };

// The Add button spins while the suggestion is being stored.
export const Adding: Story = { args: { state: { ...offer, isAccepting: true } } };

// A suggestion for today draws no Add button: starting it comes with the next ticket. No board draws it.
export const OfferForToday: Story = {
  args: { state: { ...offer, isForToday: true, accept: undefined } },
};

// The `suggestion · accepted-toast` board.
export const Accepted: Story = {
  args: {
    state: {
      status: "accepted",
      copy: {
        cardName: "Thursday",
        title: "Thursday's Legs: 19 sets",
        detail: "Now with 3 sets of incline dumbbell press. They count as planned.",
        toast: "Added to Thursday: 3 sets of incline dumbbell press",
        undoAction: "Undo",
        undoActionName: "Undo adding to Thursday",
        startActionName: "Start Legs with the added exercise",
      },
    },
  },
};

// The `suggestion · nothing-to-suggest` board.
export const NothingToAdd: Story = {
  args: {
    state: {
      status: "nothing",
      copy: {
        cardName: "Suggestion for Thursday",
        title: "Nothing to add for Thursday",
        body: "Your plan already covers your priorities. Train as planned.",
      },
    },
  },
};

// The card for a user with no goal. No board draws it.
export const NoGoal: Story = { args: { state: { status: "no_goal" } } };
