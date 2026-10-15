import { progressBars } from "@keylow/core/diary";
import { userEvent } from "storybook/test";

import { MacroProgressStrip } from "./MacroProgressStrip";

import type { Meta, StoryObj } from "@storybook/nextjs";

const targets = { kcal: 2200, protein_g: 160, carbs_g: 220, fat_g: 70 };
const noTargets = { kcal: null, protein_g: null, carbs_g: null, fat_g: null };

// Thursday 15 October on the diary canvas.
const thursday = { kcal: 1039, protein_g: 86, carbs_g: 129, fat_g: 19 };

const meta = {
  title: "UI/MacroProgressStrip",
  component: MacroProgressStrip,
  args: { bars: progressBars(thursday, targets), onPress: () => undefined },
  decorators: [
    (Story) => (
      <div className="p-4 md:p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof MacroProgressStrip>;

export default meta;

type Story = StoryObj<typeof meta>;

export const UnderTarget: Story = {};

// Every bar is exactly full and none is outlined.
export const AtTarget: Story = {
  args: {
    bars: progressBars({ kcal: 2200, protein_g: 160, carbs_g: 220, fat_g: 70 }, targets),
  },
};

// The lasagne day: calories, carbs and fat are over, protein is not. A bar that is over is full and takes
// a brighter outline of its own colour, never the warning colour.
const lasagneDay = progressBars({ kcal: 2412, protein_g: 150, carbs_g: 257, fat_g: 81 }, targets);

export const OverTarget: Story = { args: { bars: lasagneDay } };

// All four over at once.
export const AllOverTarget: Story = {
  args: {
    bars: progressBars({ kcal: 2412, protein_g: 171, carbs_g: 257, fat_g: 81 }, targets),
  },
};

// With no target the line is the value and its unit alone, and there is no bar.
export const NoTarget: Story = {
  args: { bars: progressBars(thursday, noTargets) },
};

// Four digits of calories must stay on one line, also in the narrower calories column on a phone.
export const FourDigitCalories: Story = {
  args: {
    bars: progressBars({ kcal: 1987, protein_g: 143, carbs_g: 204, fat_g: 66 }, targets),
  },
  globals: { viewport: { value: "mobile", isRotated: false } },
};

// The phone layout: the calories column is one and a half times a macro column, with an 8 px gap.
export const OnPhone: Story = {
  globals: { viewport: { value: "mobile", isRotated: false } },
};

export const OverTargetOnPhone: Story = {
  args: { bars: lasagneDay },
  globals: { viewport: { value: "mobile", isRotated: false } },
};

// The wide layout: four equal columns, 24 px apart.
export const OnDesktop: Story = {
  globals: { viewport: { value: "desktop", isRotated: false } },
};

// Focus is real: the play function tabs onto the strip, so the ring shows as it does for a keyboard.
export const Focused: Story = {
  play: async () => {
    await userEvent.tab();
  },
};
