import { View } from "react-native";

import { BodyFigure } from "./BodyFigure";
import { heatSteps, inTurn } from "./storyValues";

import type { Meta, StoryObj } from "@storybook/react-native";

const meta = {
  title: "UI/BodyFigure",
  component: BodyFigure,
  decorators: [
    (Story) => (
      <View className="flex-1 items-center justify-center p-4">
        <Story />
      </View>
    ),
  ],
  // The body map screen draws it at 120 points. The scheme comes from the theme toolbar, so each story
  // shows in dark and in light.
  args: { side: "front", scale: "heat", values: heatSteps, label: "Body map, front", w: 120 },
} satisfies Meta<typeof BodyFigure>;

export default meta;

type Story = StoryObj<typeof meta>;

// Heat steps 0 to 5 from rested to peak. Peak glows.
export const Heat: Story = {};

export const HeatBack: Story = { args: { side: "back", label: "Body map, back" } };

// Not trained, maintaining, growing, productive and high.
export const Volume: Story = { args: { scale: "volume", values: inTurn(5) } };

// Behind, on plan, ahead and not in plan.
export const Gap: Story = { args: { scale: "gap", values: inTurn(4) } };

// The selected muscle is outlined in the primary text colour, as the muscle sheet's board has it.
export const Selected: Story = { args: { selected: "chest_upper" } };

// The whole figure at 30 % strength, as the actual map fades out for the projected one.
export const Dimmed: Story = { args: { dim: 0.3 } };

// Only the muscles at heat step 5 glow.
export const Glow: Story = { args: { values: { quads: 5, chest_lower: 5, biceps: 5, abs: 4 } } };

// A muscle with no value is at rest, so a figure with none is the grey body.
export const AtRest: Story = { args: { values: {}, w: 84 } };

export const Female: Story = { args: { body: "female" } };

export const FemaleBack: Story = {
  args: { body: "female", side: "back", label: "Body map, back" },
};

// The sizes the cards use: 64 points on the finish card, 120 on the body map screen.
export const Sizes: Story = {
  render: (args) => (
    <View className="flex-row items-end gap-6">
      <BodyFigure {...args} w={64} />
      <BodyFigure {...args} w={120} />
    </View>
  ),
};

// With handlers each muscle is a button. A press on the empty figure is left to the press around it.
export const Interactive: Story = {
  args: { onPressMuscle: () => undefined, onLongPressMuscle: () => undefined },
};
