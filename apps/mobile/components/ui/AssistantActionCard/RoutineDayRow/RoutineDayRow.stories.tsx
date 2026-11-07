import { View } from "react-native";

import { RoutineDayRow } from "./RoutineDayRow";

import type { Meta, StoryObj } from "@storybook/react-native";

// The row has no surface of its own, so the stories draw it on the card's, as the card does.
const meta = {
  title: "UI/AssistantActionCard/RoutineDayRow",
  component: RoutineDayRow,
  decorators: [
    (Story) => (
      <View className="flex-1 justify-center p-4">
        <View className="overflow-hidden rounded-large border border-border bg-surface">
          <Story />
        </View>
      </View>
    ),
  ],
} satisfies Meta<typeof RoutineDayRow>;

export default meta;

type Story = StoryObj<typeof meta>;

const pushDay = {
  name: "Monday · Push",
  summary: "5 exercises · 15 sets · about 50 min",
  exercises: [
    { name: "Barbell bench press", detail: "3 sets · 8 to 10 reps · RIR 2" },
    { name: "Overhead press", detail: "3 sets · 8 to 10 reps · RIR 2" },
    { name: "Incline dumbbell press", detail: "3 sets · 8 to 10 reps · RIR 2" },
    { name: "Lateral raise", detail: "3 sets · 12 to 15 reps · RIR 1" },
    { name: "Triceps pushdown", detail: "3 sets · 12 to 15 reps · RIR 1" },
  ],
};

// A closed day: the name, the summary and the chevron pointing down.
export const Closed: Story = {
  args: { day: pushDay, isOpen: false, onPress: () => undefined },
};

// An open day: the chevron points up and the exercises are listed in place, each a name over its detail.
export const Open: Story = {
  args: { day: pushDay, isOpen: true, onPress: () => undefined },
};
