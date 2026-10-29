import { useState } from "react";
import { userEvent } from "storybook/test";

import { SegmentedControl } from "./SegmentedControl";

import type { Meta, StoryObj } from "@storybook/nextjs";

const appearanceOptions = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
  { value: "device", label: "Match device" },
] as const;

const basisOptions = [
  { value: "per_100g", label: "Per 100 g" },
  { value: "per_100ml", label: "Per 100 ml" },
] as const;

// The control is controlled, so each story keeps the choice in state and a click moves it.
function Appearance({ initial }: { initial: (typeof appearanceOptions)[number]["value"] }) {
  const [value, setValue] = useState<(typeof appearanceOptions)[number]["value"]>(initial);
  return (
    <SegmentedControl
      label="Appearance"
      options={appearanceOptions}
      value={value}
      onChange={setValue}
    />
  );
}

const roleOptions = [
  { value: "primary", label: "Primary" },
  { value: "secondary", label: "Second" },
  { value: "assisting", label: "Assist" },
] as const;

// The small size is as wide as its row makes it, so the story fixes a width as the board does.
function MuscleRole({ initial }: { initial: (typeof roleOptions)[number]["value"] }) {
  const [value, setValue] = useState<(typeof roleOptions)[number]["value"]>(initial);
  return (
    <SegmentedControl
      label="Role for Side delts"
      options={roleOptions}
      value={value}
      onChange={setValue}
      size="sm"
      className="w-[156px]"
    />
  );
}

const meta = {
  title: "UI/SegmentedControl",
  decorators: [
    (Story) => (
      <div className="max-w-md p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = { render: () => <Appearance initial="dark" /> };

export const SecondSelected: Story = { render: () => <Appearance initial="light" /> };

export const TwoOptions: Story = {
  render: () => (
    <SegmentedControl
      label="Basis"
      options={basisOptions}
      value="per_100g"
      onChange={() => undefined}
      className="max-w-[320px]"
    />
  ),
};

// Focus is real: the play function tabs onto the selected segment, so the ring shows as it does for a keyboard.
export const Focused: Story = {
  render: () => <Appearance initial="dark" />,
  play: async () => {
    await userEvent.tab();
  },
};

// The small size on the custom exercise form: a muscle's role, in a row that has its name and a remove button too.
export const Small: Story = { render: () => <MuscleRole initial="primary" /> };

export const SmallFocused: Story = {
  render: () => <MuscleRole initial="secondary" />,
  play: async () => {
    await userEvent.tab();
  },
};
