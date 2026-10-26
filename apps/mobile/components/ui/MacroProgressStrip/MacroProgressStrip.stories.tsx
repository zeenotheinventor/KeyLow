import { progressBars } from "@keylow/core/diary";
import { View } from "react-native";

import { Card } from "../Card";
import { MacroProgressStrip } from "./MacroProgressStrip";

import type { Meta, StoryObj } from "@storybook/react-native";

// The diary's strip is the button to Targets; the plate stories below are the status form with no button.
const onPress = () => undefined;
const targets = { kcal: 2200, protein_g: 160, carbs_g: 220, fat_g: 70 };
const noTargets = { kcal: null, protein_g: null, carbs_g: null, fat_g: null };
const eaten = { kcal: 1039, protein_g: 86, carbs_g: 129.1, fat_g: 19 };
// The plate boards: plate-several adds 658 kcal, P 57, C 79, F 12 (1,697 / 2,200), and plate-over adds
// 1,241 kcal, P 69, C 181, F 26, which takes calories and carbs past their targets.
const severalOnPlate = { kcal: 658, protein_g: 57, carbs_g: 79, fat_g: 12 };
const overOnPlate = { kcal: 1241, protein_g: 69.1, carbs_g: 180.8, fat_g: 25.8 };

const meta = {
  title: "UI/MacroProgressStrip",
  component: MacroProgressStrip,
  decorators: [
    (Story) => (
      <View className="flex-1 justify-center">
        <Story />
      </View>
    ),
  ],
  args: { bars: progressBars(eaten, targets) },
} satisfies Meta<typeof MacroProgressStrip>;

export default meta;

type Story = StoryObj<typeof meta>;

// The diary board's day: 1,039 of 2,200 kcal, with protein, carbs and fat well under.
export const UnderTarget: Story = { args: { onPress } };

// Every bar exactly at its target: full, with no outline.
export const AtTarget: Story = {
  args: {
    onPress,
    bars: progressBars({ kcal: 2200, protein_g: 160, carbs_g: 220, fat_g: 70 }, targets),
  },
};

// Every bar past its target: full, with a brighter outline of its own colour and the values in primary text.
export const OverTarget: Story = {
  args: {
    onPress,
    bars: progressBars({ kcal: 2412, protein_g: 175, carbs_g: 257, fat_g: 81 }, targets),
  },
};

// With no target each column reads its value and unit, and draws no bar.
export const NoTarget: Story = { args: { bars: progressBars(eaten, noTargets), onPress } };

// The widest calorie figure the column has to hold on one line.
export const FourDigitCalories: Story = {
  args: {
    onPress,
    bars: progressBars({ kcal: 2412, protein_g: 86, carbs_g: 129.1, fat_g: 19 }, targets),
  },
};

// The log search's `log-search · plate-several` board: the day with the plate's share after the eaten fill
// in the same colour at 45 per cent, the number eaten plus the plate, and no button (the plate would be lost).
export const WithPlate: Story = {
  args: {
    bars: progressBars(eaten, targets, severalOnPlate),
    label: "Today with your plate",
  },
};

// `log-search · plate-over`: calories and carbs are over with the plate, so those two bars are full with the
// outline and the number in primary text. Protein and fat stay under.
export const PlateOverTarget: Story = {
  args: {
    bars: progressBars(eaten, targets, overOnPlate),
    label: "Today with your plate",
  },
};

// `log-search · plate-empty`: the status form with an empty plate, named "Today".
export const StatusGroup: Story = {
  args: { bars: progressBars(eaten, targets), label: "Today" },
};

// `plate · open`: the card form under "Today with your plate", with no padding of its own and the outline's
// gap in the surface colour. Calories and carbs are over, so the gap shows.
export const CardForm: Story = {
  args: {
    bars: progressBars(eaten, targets, overOnPlate),
    label: "Today with your plate",
    surface: "card",
  },
  render: (args) => (
    <View className="px-4">
      <Card>
        <MacroProgressStrip {...args} />
      </Card>
    </View>
  ),
};
