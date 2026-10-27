import { View } from "react-native";

import { WeeklySetsBar } from "./WeeklySetsBar";

import type { Meta, StoryObj } from "@storybook/react-native";

const bands = { growingFromSets: 4, productiveFromSets: 10, highAboveSets: 20 };
const labels = { start: "0", growing: "4", productive: "10", high: "20" };
const bandRule = "Growing from 4 sets, Productive from 10, High above 20";

const meta = {
  title: "BodyMap/WeeklySetsBar",
  component: WeeklySetsBar,
  args: {
    name: `5.5 sets done, Growing, 11 planned. ${bandRule}`,
    labels,
    weeklySets: {
      actual: 5.5,
      planned: 11,
      bands,
      actualStatus: "growing",
      plannedStatus: "productive",
      volumeStatus: "growing",
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

// The golden side delts on Thursday evening: growing so far, with the plan reaching Productive.
export const Growing: Story = {};

// Nothing done and nothing planned: an empty bar, and the planned tick at the start.
export const NotTrained: Story = {
  args: {
    name: `0 sets done, Not trained, 0 planned. ${bandRule}`,
    weeklySets: {
      actual: 0,
      planned: 0,
      bands,
      actualStatus: "not_trained",
      plannedStatus: "not_trained",
      volumeStatus: "not_trained",
    },
  },
};

// Inside the productive range, filled in the productive colour.
export const Productive: Story = {
  args: {
    name: `12 sets done, Productive, 12 planned. ${bandRule}`,
    weeklySets: {
      actual: 12,
      planned: 12,
      bands,
      actualStatus: "productive",
      plannedStatus: "productive",
      volumeStatus: "productive",
    },
  },
};

// Past 20 sets: the fill is in the High colour.
export const High: Story = {
  args: {
    name: `22 sets done, High, 22 planned. ${bandRule}`,
    weeklySets: {
      actual: 22,
      planned: 22,
      bands,
      actualStatus: "high",
      plannedStatus: "high",
      volumeStatus: "high",
    },
  },
};
