import { useState } from "react";
import { View } from "react-native";

import { DayStepper } from "./DayStepper";

import type { Meta, StoryObj } from "@storybook/react-native";

// Thursday 15 October 2026, the sample day of the diary boards. The time zone is fixed so the stories
// read the same wherever they are opened.
const today = new Date("2026-10-15T12:00:00Z");

const meta = {
  title: "UI/DayStepper",
  component: DayStepper,
  decorators: [
    (Story) => (
      <View className="flex-1 justify-center p-4">
        <Story />
      </View>
    ),
  ],
  args: { date: today, today, timeZone: "UTC" },
} satisfies Meta<typeof DayStepper>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Today: Story = {};

export const Yesterday: Story = { args: { date: new Date("2026-10-14T12:00:00Z") } };

export const OlderDay: Story = { args: { date: new Date("2026-10-12T12:00:00Z") } };

// A screen that keeps the day, so the steps move it and the label cuts in.
function SteppedDiary() {
  const [day, setDay] = useState(today);
  return <DayStepper date={day} timeZone="UTC" today={today} onChange={setDay} />;
}

export const Interactive: Story = { render: () => <SteppedDiary /> };
