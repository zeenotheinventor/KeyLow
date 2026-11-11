import { View } from "react-native";

import { ExerciseFormEntry } from "./ExerciseFormEntry";
import { ThemeScope } from "../../../lib/theme";

import type { Meta, StoryObj } from "@storybook/react-native";

// The board `assistant-card · exercise-form`, the card alone, with a stubbed event. Each story draws it once
// in dark and once in light, as the board does, whatever the theme toolbar says.
const meta = {
  title: "Assistant/ExerciseFormEntry",
  component: ExerciseFormEntry,
  render: (args) => (
    <View className="flex-1">
      {(["dark", "light"] as const).map((scheme) => (
        <ThemeScope
          key={scheme}
          className="flex-1 justify-center bg-background p-4"
          scheme={scheme}
        >
          <ExerciseFormEntry {...args} />
        </ThemeScope>
      ))}
    </View>
  ),
} satisfies Meta<typeof ExerciseFormEntry>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Video: Story = {
  args: {
    exercise: {
      exerciseName: "Barbell Squat",
      media: {
        kind: "video",
        videoId: "abcdefghijk",
        title: "How to do a barbell back squat with perfect form, step by step",
        channel: "Strength Basics",
      },
    },
  },
};

export const Photos: Story = {
  args: {
    exercise: {
      exerciseName: "Barbell Squat",
      media: { kind: "photos", imagePaths: ["Barbell_Squat/0.jpg", "Barbell_Squat/1.jpg"] },
    },
  },
};
