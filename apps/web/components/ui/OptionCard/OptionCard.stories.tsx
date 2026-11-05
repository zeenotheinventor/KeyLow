import { useState } from "react";
import { userEvent } from "storybook/test";

import { OptionCard } from "./OptionCard";
import { OptionCardGroup } from "./OptionCardGroup";

import type { OptionCardGroupOption } from "./types";
import type { Meta, StoryObj } from "@storybook/nextjs";

// The words stand in for the goals questionnaire's own, which a screen takes from `@keylow/core/copy`.
type StoryGoal = "aesthetic" | "strength" | "hybrid";

const goals: readonly OptionCardGroupOption<StoryGoal>[] = [
  {
    id: "aesthetic",
    title: "Look better",
    description: "Build muscle where it shows, in proportion",
  },
  {
    id: "strength",
    title: "Get stronger",
    description: "Lift more on the squat, bench, deadlift and overhead press",
  },
  { id: "hybrid", title: "Both", description: "Strength on the big lifts, size everywhere else" },
];

type StoryFocus = "v_taper" | "chest" | "arms";

const focuses: readonly OptionCardGroupOption<StoryFocus>[] = [
  { id: "v_taper", title: "V-taper", description: "Wider shoulders and back, a narrower waist" },
  { id: "chest", title: "Chest", description: "Upper and lower chest" },
  { id: "arms", title: "Arms", description: "Biceps, triceps and forearms" },
];

// The answer is kept by the screen that asks, so a story keeps it too and a press moves it.
function Goal({ initial }: { initial: StoryGoal | undefined }) {
  const [value, setValue] = useState(initial);
  return (
    <OptionCardGroup
      label="What are you training for?"
      options={goals}
      value={value}
      onChange={setValue}
    />
  );
}

function Focus({ initial }: { initial: StoryFocus[] }) {
  const [value, setValue] = useState<StoryFocus[]>(initial);
  return (
    <OptionCardGroup
      selection="multiple"
      label="Anything to focus on?"
      options={focuses}
      value={value}
      onChange={setValue}
    />
  );
}

const meta = {
  title: "UI/OptionCard",
  component: OptionCard,
  args: { title: "Look better", checked: false, onPress: () => undefined },
  decorators: [
    (Story) => (
      <div className="max-w-md p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof OptionCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Unchosen: Story = {
  args: { description: "Build muscle where it shows, in proportion" },
};

export const Chosen: Story = {
  args: { description: "Build muscle where it shows, in proportion", checked: true },
};

export const WithBadge: Story = {
  args: { title: "0.5% a week", description: "A steady pace.", badge: { children: "Suggested" } },
};

export const WithValue: Story = {
  args: {
    title: "0.25% a week",
    description: "Gentle, and easy to keep up.",
    value: "0.2 kg",
    valueCaption: "a week",
    valueLabel: "about 0.2 kilograms a week",
  },
};

export const DisabledWithReason: Story = {
  args: { title: "Lose weight", disabledReason: "Not offered under 18." },
};

export const Group: Story = { render: () => <Goal initial="aesthetic" /> };

// Focus is real: the play function tabs onto the chosen card, so the ring shows as it does for a keyboard.
export const GroupFocused: Story = {
  render: () => <Goal initial="aesthetic" />,
  play: async () => {
    await userEvent.tab();
  },
};

export const CheckboxUnchecked: Story = {
  args: { selection: "multiple", description: "Upper and lower chest", title: "Chest" },
};

export const CheckboxChecked: Story = {
  args: {
    selection: "multiple",
    description: "Upper and lower chest",
    title: "Chest",
    checked: true,
  },
};

export const GroupMultiple: Story = { render: () => <Focus initial={["v_taper"]} /> };
