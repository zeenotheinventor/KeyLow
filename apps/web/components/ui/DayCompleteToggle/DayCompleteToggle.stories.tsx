import { useState } from "react";

import { DayCompleteToggle } from "./DayCompleteToggle";

import type { Meta, StoryObj } from "@storybook/nextjs";

const meta = {
  title: "UI/DayCompleteToggle",
  component: DayCompleteToggle,
  decorators: [
    (Story) => (
      <div className="max-w-sm p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DayCompleteToggle>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Off: Story = { args: { complete: false } };

export const On: Story = { args: { complete: true } };

export const Disabled: Story = { args: { complete: false, disabled: true } };

export const DisabledOn: Story = { args: { complete: true, disabled: true } };

function MarkableToggle() {
  const [complete, setComplete] = useState(false);
  return <DayCompleteToggle complete={complete} onChange={setComplete} />;
}

// Press it to see the slash and the punch. Unmarking is quiet.
export const Interactive: Story = { render: () => <MarkableToggle /> };
