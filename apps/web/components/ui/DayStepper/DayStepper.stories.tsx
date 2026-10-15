import { useState } from "react";

import { DayStepper } from "./DayStepper";

import type { Meta, StoryObj } from "@storybook/nextjs";

// Thursday 15 October 2026. The time zone is fixed so the stories read the same on any machine.
const today = new Date("2026-10-15T12:00:00Z");

const meta = {
  title: "UI/DayStepper",
  component: DayStepper,
  args: { date: today, today, timeZone: "UTC" },
  decorators: [
    (Story) => (
      <div className="max-w-sm p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DayStepper>;

export default meta;

type Story = StoryObj<typeof meta>;

export const OnToday: Story = {};

export const OnYesterday: Story = { args: { date: new Date("2026-10-14T12:00:00Z") } };

export const OnTomorrow: Story = { args: { date: new Date("2026-10-16T12:00:00Z") } };

export const OnAnOlderDay: Story = { args: { date: new Date("2026-10-12T12:00:00Z") } };

function SteppingStepper() {
  const [date, setDate] = useState(new Date("2026-10-14T12:00:00Z"));
  return <DayStepper date={date} today={today} timeZone="UTC" onChange={setDate} />;
}

// Press the arrows to see the label wipe in, mirrored when stepping back.
export const Stepping: Story = { render: () => <SteppingStepper /> };
