import { useState } from "react";
import { View } from "react-native";

import { ChipGroup } from "./ChipGroup";

import type { ChipGroupOption } from "./types";
import type { Meta, StoryObj } from "@storybook/react-native";

// The labels stand in for the strings a screen builds, such as the portion picker's, which are not this component's.
type StoryUnit = string;

const twoUnits: ChipGroupOption<StoryUnit>[] = [
  { value: "breast", label: "1 breast (150 g)" },
  { value: "g", label: "g" },
];

const fiveUnits: ChipGroupOption<StoryUnit>[] = [
  { value: "slice", label: "1 slice (30 g)" },
  { value: "cup", label: "1 cup (240 ml)" },
  { value: "breast", label: "1 breast (150 g)" },
  { value: "g", label: "g" },
  { value: "ml", label: "ml" },
];

const longLabelUnits: ChipGroupOption<StoryUnit>[] = [
  { value: "pack", label: "1 family pack of sliced wholemeal sandwich bread with seeds (800 g)" },
  { value: "g", label: "g" },
];

// The choice is kept by the screen that holds it, so a story keeps it too and a press moves it.
function Units({
  options,
  initial,
}: {
  options: ChipGroupOption<StoryUnit>[];
  initial: StoryUnit | null;
}) {
  const [value, setValue] = useState(initial);
  return <ChipGroup label="Unit" options={options} value={value} onChange={setValue} />;
}

const meta = {
  title: "UI/ChipGroup",
  component: ChipGroup,
  decorators: [
    (Story) => (
      <View className="flex-1 justify-center p-4">
        <Story />
      </View>
    ),
  ],
  // Every story renders its own kept choice, so these only satisfy the props.
  args: {
    label: "Unit",
    options: twoUnits,
    value: "g",
    onChange: () => undefined,
  },
} satisfies Meta<typeof ChipGroup<StoryUnit>>;

export default meta;

type Story = StoryObj<typeof meta>;

// The portion picker's usual two: the food's own portion and grams.
export const TwoChips: Story = { render: () => <Units options={twoUnits} initial="g" /> };

// More chips than the width holds, so the row scrolls sideways.
export const FiveChipsScroll: Story = {
  render: () => <Units options={fiveUnits} initial="breast" />,
};

// A label wider than the screen is scrolled to, not cut.
export const LongLabel: Story = {
  render: () => <Units options={longLabelUnits} initial="pack" />,
};

// One chip chosen: the filled accent chip among the raised ones.
export const OneSelected: Story = { render: () => <Units options={fiveUnits} initial="g" /> };

// None chosen yet: every chip is raised.
export const NoneSelected: Story = { render: () => <Units options={fiveUnits} initial={null} /> };
