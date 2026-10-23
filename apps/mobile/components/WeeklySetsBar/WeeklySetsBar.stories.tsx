import { View } from "react-native";

import { WeeklySetsBar } from "./WeeklySetsBar";

import type { Meta, StoryObj } from "@storybook/react-native";

const meta = {
  title: "BodyMap/WeeklySetsBar",
  component: WeeklySetsBar,
  args: {
    name: "5.5 sets done, 11 planned, target 10 to 16, minimum 6, maximum 22",
    labels: { start: "0", minimum: "Min 6", planned: "Planned 11", maximum: "Max 22" },
    weeklySets: {
      actual: 5.5,
      planned: 11,
      target: { mev: 6, mav: { low: 10, high: 16 }, mrv: 22 },
      actualPosition: "below",
      plannedPosition: "inside",
      volumeStatus: "under",
    },
  },
  decorators: [
    (Story) => (
      <View className="p-4">
        <Story />
      </View>
    ),
  ],
} satisfies Meta<typeof WeeklySetsBar>;

export default meta;

type Story = StoryObj<typeof meta>;

// The golden side delts on Thursday evening: under the minimum so far, with the plan reaching the target.
export const BelowTarget: Story = {};

// Inside the productive range, filled in the productive colour.
export const InsideTarget: Story = {
  args: {
    name: "12 sets done, 12 planned, target 10 to 16, minimum 6, maximum 22",
    labels: { start: "0", minimum: "Min 6", planned: "Planned 12", maximum: "Max 22" },
    weeklySets: {
      actual: 12,
      planned: 12,
      target: { mev: 6, mav: { low: 10, high: 16 }, mrv: 22 },
      actualPosition: "inside",
      plannedPosition: "inside",
      volumeStatus: "productive",
    },
  },
};

const target = { mev: 6, mav: { low: 10, high: 16 }, mrv: 22 };

// Nothing planned: the planned label hangs from the left on a row of its own, clear of the 0.
export const PlannedNothing: Story = {
  args: {
    name: "0 sets done, 0 planned, target 10 to 16, minimum 6, maximum 22",
    labels: { start: "0", minimum: "Min 6", planned: "Planned 0", maximum: "Max 22" },
    weeklySets: {
      actual: 0,
      planned: 0,
      target,
      actualPosition: "below",
      plannedPosition: "below",
      volumeStatus: "under",
    },
  },
};

// A planned figure of 7 beside the minimum of 6: the planned label takes a row of its own.
export const PlannedBesideMinimum: Story = {
  args: {
    name: "5.5 sets done, 7 planned, target 10 to 16, minimum 6, maximum 22",
    labels: { start: "0", minimum: "Min 6", planned: "Planned 7", maximum: "Max 22" },
    weeklySets: {
      actual: 5.5,
      planned: 7,
      target,
      actualPosition: "below",
      plannedPosition: "below",
      volumeStatus: "under",
    },
  },
};

// A planned figure at the maximum: the planned label hangs from the right on a row of its own, clear of the Max.
export const PlannedAtMaximum: Story = {
  args: {
    name: "16 sets done, 22 planned, target 10 to 16, minimum 6, maximum 22",
    labels: { start: "0", minimum: "Min 6", planned: "Planned 22", maximum: "Max 22" },
    weeklySets: {
      actual: 16,
      planned: 22,
      target,
      actualPosition: "inside",
      plannedPosition: "above",
      volumeStatus: "productive",
    },
  },
};
