import { FOOD_FORM } from "@keylow/core/copy";
import { useState } from "react";
import { View } from "react-native";

import { SegmentedControl } from "./SegmentedControl";

import type { SegmentedControlOption } from "./types";
import type { Meta, StoryObj } from "@storybook/react-native";

type Basis = "per_100g" | "per_100ml";
type Appearance = "dark" | "light" | "system";

const basisOptions: SegmentedControlOption<Basis>[] = [
  { value: "per_100g", label: FOOD_FORM.basisOptions.per_100g },
  { value: "per_100ml", label: FOOD_FORM.basisOptions.per_100ml },
];

const appearanceOptions: SegmentedControlOption<Appearance>[] = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
  { value: "system", label: "Match device" },
];

// A choice is kept by the screen that holds it, so a story keeps it too and a press moves it.
function BasisChoice({ initial }: { initial: Basis }) {
  const [value, setValue] = useState(initial);
  return (
    <SegmentedControl
      label="Nutrition basis"
      options={basisOptions}
      value={value}
      onChange={setValue}
    />
  );
}

function AppearanceChoice({ initial }: { initial: Appearance }) {
  const [value, setValue] = useState(initial);
  return (
    <SegmentedControl
      label="Appearance"
      options={appearanceOptions}
      value={value}
      onChange={setValue}
    />
  );
}

const meta = {
  title: "UI/SegmentedControl",
  component: SegmentedControl,
  decorators: [
    (Story) => (
      <View className="flex-1 justify-center p-4">
        <Story />
      </View>
    ),
  ],
  // Every story renders its own kept choice, so these only satisfy the props.
  args: {
    label: "Nutrition basis",
    options: basisOptions,
    value: "per_100g",
    onChange: () => undefined,
  },
} satisfies Meta<typeof SegmentedControl>;

export default meta;

type Story = StoryObj<typeof meta>;

// The food form's basis: per 100 g chosen, then per 100 ml chosen.
export const PerHundredGrams: Story = { render: () => <BasisChoice initial="per_100g" /> };

export const PerHundredMillilitres: Story = { render: () => <BasisChoice initial="per_100ml" /> };

// More's Appearance row: the choice that is in force is the chosen one.
export const AppearanceDark: Story = { render: () => <AppearanceChoice initial="dark" /> };

export const AppearanceLight: Story = { render: () => <AppearanceChoice initial="light" /> };

export const AppearanceMatchDevice: Story = { render: () => <AppearanceChoice initial="system" /> };
