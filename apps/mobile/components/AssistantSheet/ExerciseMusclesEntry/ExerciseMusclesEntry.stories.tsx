import { View } from "react-native";

import { ExerciseMusclesEntry } from "./ExerciseMusclesEntry";
import { ThemeScope } from "../../../lib/theme";

import type { Meta, StoryObj } from "@storybook/react-native";

// The board `assistant-card · exercise-muscles`, the card alone, with the board's own words. The story draws
// it once in dark and once in light, as the board does, whatever the theme toolbar says.
const meta = {
  title: "Assistant/ExerciseMusclesEntry",
  component: ExerciseMusclesEntry,
  args: {
    exercise: {
      exerciseName: "Romanian Deadlift",
      muscles: [
        { muscle_id: "hamstrings", role: "primary" },
        { muscle_id: "lower_back", role: "secondary" },
        { muscle_id: "glute_max", role: "secondary" },
        { muscle_id: "calves", role: "stabiliser" },
      ],
    },
  },
  render: (args) => (
    <View className="flex-1">
      {(["dark", "light"] as const).map((scheme) => (
        <ThemeScope
          key={scheme}
          className="flex-1 justify-center bg-background p-4"
          scheme={scheme}
        >
          <ExerciseMusclesEntry {...args} />
        </ThemeScope>
      ))}
    </View>
  ),
} satisfies Meta<typeof ExerciseMusclesEntry>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Muscles: Story = {};
