import { View } from "react-native";

import { RoutineCard } from "./RoutineCard";
import { sampleActiveRoutine } from "../RoutinesView/sampleRoutines";

import type { Meta, StoryObj } from "@storybook/react-native";

const meta = {
  title: "Train/RoutineCard",
  component: RoutineCard,
  decorators: [
    (Story) => (
      <View className="p-4">
        <Story />
      </View>
    ),
  ],
  // The golden Push Pull Legs of the `routines · list` board.
  args: sampleActiveRoutine,
} satisfies Meta<typeof RoutineCard>;

export default meta;

type Story = StoryObj<typeof meta>;

// The card as the list draws it before the editor exists: information, not a button.
export const Active: Story = {};

// With the editor behind it the whole card opens it, and its name ends in Edit.
export const OpensTheEditor: Story = { args: { onPress: () => undefined } };

// A routine that has no activation date yet reads without "since".
export const WithoutDate: Story = { args: { activeFrom: null } };
