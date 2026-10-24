import { useState } from "react";
import { View } from "react-native";

import { OptionCard } from "./OptionCard";
import { OptionCardGroup } from "./OptionCardGroup";

import type { OptionCardGroupOption } from "./types";
import type { Meta, StoryObj } from "@storybook/react-native";

// The words stand in for the setup's own, which a screen takes from `@keylow/core/copy`.
type StoryGoal = "lose" | "maintain" | "gain";

const goals: readonly OptionCardGroupOption<StoryGoal>[] = [
  { id: "lose", title: "Lose weight", description: "Eat a little less than you use." },
  { id: "maintain", title: "Maintain weight", description: "Eat about what you use." },
  { id: "gain", title: "Gain weight", description: "Eat a little more than you use." },
];

const goalsUnderEighteen: readonly OptionCardGroupOption<StoryGoal>[] = [
  { id: "lose", title: "Lose weight", disabledReason: "Not offered under 18." },
  ...goals.slice(1),
];

// The answer is kept by the screen that asks, so a story keeps it too and a press moves it.
function Goal({
  options,
  initial,
}: {
  options: readonly OptionCardGroupOption<StoryGoal>[];
  initial: StoryGoal | undefined;
}) {
  const [value, setValue] = useState(initial);
  return (
    <OptionCardGroup
      label="What is your goal?"
      options={options}
      value={value}
      onChange={setValue}
    />
  );
}

type StoryRate = "gentle" | "steady" | "fast";

const rates: readonly OptionCardGroupOption<StoryRate>[] = [
  {
    id: "gentle",
    title: "0.25% a week",
    description: "Gentle, and easy to keep up.",
    value: "0.2 kg",
    valueCaption: "a week",
    valueLabel: "about 0.2 kilograms a week",
  },
  {
    id: "steady",
    title: "0.5% a week",
    description: "A steady pace.",
    badge: { children: "Suggested", outlined: true },
    value: "0.4 kg",
    valueCaption: "a week",
    valueLabel: "about 0.4 kilograms a week",
  },
  {
    id: "fast",
    title: "0.75% a week",
    description: "Faster, and harder to keep up.",
    value: "0.6 kg",
    valueCaption: "a week",
    valueLabel: "about 0.6 kilograms a week",
  },
];

function Rate() {
  const [value, setValue] = useState<StoryRate | undefined>("steady");
  return (
    <OptionCardGroup
      label="How fast do you want to lose weight?"
      options={rates}
      value={value}
      onChange={setValue}
    />
  );
}

const meta = {
  title: "UI/OptionCard",
  component: OptionCard,
  decorators: [
    (Story) => (
      <View className="flex-1 justify-center p-4">
        <Story />
      </View>
    ),
  ],
  args: { title: "Female", checked: false, onPress: () => undefined },
} satisfies Meta<typeof OptionCard>;

export default meta;

type Story = StoryObj<typeof meta>;

// The sex question's cards: a title and nothing else, not chosen.
export const Unchosen: Story = {};

// Chosen: the accent border at 2 points on the muted accent fill, and the radio filled.
export const Chosen: Story = {
  args: {
    title: "Lightly active",
    description: "Some walking, or exercise 1 to 3 days a week.",
    checked: true,
  },
};

// The activity question's cards: a description under the title, wrapping to as many lines as it needs.
export const WithDescription: Story = {
  args: { title: "Sedentary", description: "Mostly sitting, with little or no exercise." },
};

// The suggested rate: a badge after the title.
export const WithBadge: Story = {
  args: {
    title: "0.5% a week",
    description: "A steady pace.",
    badge: { children: "Suggested", outlined: true },
    checked: true,
  },
};

// A figure at the end of the card with its caption muted under it.
export const WithValue: Story = {
  args: {
    title: "High",
    description: "2.0 g per kg. Suits regular strength training.",
    value: "160 g",
    valueCaption: "a day",
  },
};

// The badge and the value together, chosen, as the rate question draws its suggested card.
export const ChosenWithBadgeAndValue: Story = {
  args: {
    title: "0.5% a week",
    description: "A steady pace.",
    badge: { children: "Suggested", outlined: true },
    value: "0.4 kg",
    valueCaption: "a week",
    valueLabel: "about 0.4 kilograms a week",
    checked: true,
  },
};

// Under 18 the goal question does not offer Lose weight: the radio and title are dimmed to 40 percent
// and the reason is drawn at full strength.
export const DisabledWithReason: Story = {
  args: { title: "Lose weight", disabledReason: "Not offered under 18." },
};

// The goal question, nothing chosen yet. A press chooses a card.
export const Group: Story = { render: () => <Goal initial={undefined} options={goals} /> };

// The rate question: each card has its figure at the end, and the group hands on the card's id.
export const GroupWithFigures: Story = {
  render: () => <Rate />,
};

// The same question for someone under 18, with Maintain chosen and Lose weight disabled.
export const GroupWithDisabledOption: Story = {
  render: () => <Goal initial="maintain" options={goalsUnderEighteen} />,
};
