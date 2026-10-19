import { useState } from "react";
import { View } from "react-native";

import { ChipGroup } from "./ChipGroup";

import type { ChipGroupOption, ChipGroupProps } from "./types";
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

// The equipment questions' chips: short labels that all fit on a few lines, so they wrap and none scrolls.
const tenEquipment: ChipGroupOption<StoryUnit>[] = [
  { value: "barbell", label: "Barbell" },
  { value: "dumbbell", label: "Dumbbell" },
  { value: "kettlebell", label: "Kettlebell" },
  { value: "cable", label: "Cable" },
  { value: "machine", label: "Machine" },
  { value: "smith-machine", label: "Smith machine" },
  { value: "ez-bar", label: "EZ bar" },
  { value: "band", label: "Band" },
  { value: "bodyweight", label: "Bodyweight" },
  { value: "other", label: "Other" },
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

// Several chosen, kept by the screen the same way.
function Equipment({ initial }: { initial: StoryUnit[] }) {
  const [value, setValue] = useState(initial);
  return (
    <ChipGroup
      label="Equipment"
      layout="wrap"
      options={tenEquipment}
      selection="multiple"
      value={value}
      onChange={setValue}
    />
  );
}

// The meta is typed by the single choice's props, because the component takes the props of a single choice or of several and Storybook cannot read the args of either from it.
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
} satisfies Meta<ChipGroupProps<StoryUnit>>;

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

// The chips fall onto further lines instead of scrolling, so every one shows at once.
export const WrapTenChips: Story = {
  render: () => (
    <ChipGroup
      label="Equipment"
      layout="wrap"
      options={tenEquipment}
      value="cable"
      onChange={() => undefined}
    />
  ),
};

// Several chosen: each press adds the chip or takes it out and leaves the others as they were.
export const MultipleTwoChosen: Story = {
  render: () => <Equipment initial={["barbell", "cable"]} />,
};

const rirOptions: ChipGroupOption<StoryUnit>[] = ["0", "1", "2", "3", "4", "5", "6+"].map(
  (label, index) => ({ value: String(index), label }),
);

// The set entry's RIR: seven short labels share one line in equal columns, 44 points high. Pressing the
// chosen chip again takes the choice back, since RIR is optional.
function ClearableRirChips() {
  const [value, setValue] = useState<StoryUnit | null>("1");
  return (
    <ChipGroup
      allowDeselect
      label="RIR, reps in reserve"
      layout="equal"
      options={rirOptions}
      value={value}
      onChange={setValue}
    />
  );
}

export const EqualColumnsRir: Story = {
  render: () => (
    <ChipGroup
      label="RIR, reps in reserve"
      layout="equal"
      options={rirOptions}
      value="1"
      onChange={() => undefined}
    />
  ),
};

export const ClearableRir: Story = { render: () => <ClearableRirChips /> };
