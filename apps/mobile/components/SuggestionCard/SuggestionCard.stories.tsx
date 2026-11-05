import { View } from "react-native";

import { SuggestionCard } from "./SuggestionCard";

import type { SuggestionCardProps } from "./types";
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

// The words of the `suggestion · card` board, for Thursday's Legs seen on Wednesday at 12:00.
const offer: Extract<SuggestionCardProps["state"], { status: "offer" }> = {
  status: "offer",
  day: "2026-10-15",
  isForToday: false,
  isAccepting: false,
  accept: () => undefined,
  copy: {
    cardName: "Suggestion for Thursday",
    label: "Suggested for Thursday",
    headline: "Legs, plus incline dumbbell press",
    linkName: "Suggested for Thursday: Legs, plus incline dumbbell press. See why",
    sentence: "Add 3 sets of incline dumbbell press to the end of Thursday's Legs.",
    reasonsName: "Why Ki-Lo suggests this for Thursday",
    reasons: [
      {
        kind: "volume",
        text: "Upper chest: 4.8 sets in the last 7 days, target 12, a V-taper priority",
      },
      { kind: "heat", text: "Upper chest is ready now: heat 13 %" },
      { kind: "length", text: "Thursday goes from 16 to 19 sets, about 60 minutes" },
    ],
    primaryAction: "Add to Thursday",
    primaryActionName: "Add to Thursday",
    dismissAction: "Not now",
    dismissActionName: "Not now for Thursday's suggestion",
  },
};

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
