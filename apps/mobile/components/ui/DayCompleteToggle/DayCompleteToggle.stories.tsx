import { useState } from "react";
import { View } from "react-native";

import { DayCompleteToggle } from "./DayCompleteToggle";

import type { Meta, StoryObj } from "@storybook/react-native";

const meta = {
  title: "UI/DayCompleteToggle",
  component: DayCompleteToggle,
  decorators: [
    (Story) => (
      <View className="flex-1 justify-center p-4">
        <Story />
      </View>
    ),
  ],
  args: { complete: false },
} satisfies Meta<typeof DayCompleteToggle>;

export default meta;

type Story = StoryObj<typeof meta>;

// A screen that keeps the choice, so marking the day complete plays the moment.
function MarkableDay({ initiallyComplete }: { initiallyComplete: boolean }) {
  const [complete, setComplete] = useState(initiallyComplete);
  return <DayCompleteToggle complete={complete} onChange={setComplete} />;
}

export const Off: Story = { render: () => <MarkableDay initiallyComplete={false} /> };

export const On: Story = { render: () => <MarkableDay initiallyComplete /> };

export const Disabled: Story = { args: { disabled: true } };

export const DisabledOn: Story = { args: { disabled: true, complete: true } };
