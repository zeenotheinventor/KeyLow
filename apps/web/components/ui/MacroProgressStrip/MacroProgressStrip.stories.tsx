import { progressBars } from "@keylow/core/diary";
import { userEvent } from "storybook/test";

import { MacroProgressStrip } from "./MacroProgressStrip";
import { MacroProgressStripSkeleton } from "./MacroProgressStripSkeleton";

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

// The plate: four foods come to 658 kcal, P 57.2, C 79.1, F 11.9, so the day reads 1,697 kcal. Each bar draws
// the plate's share after the eaten fill, in the same colour at 45 per cent.
const goldenPlate = { kcal: 658, protein_g: 57.2, carbs_g: 79.1, fat_g: 11.9 };
// With the naan and the crisps on top: 2,257 kcal, P 157.2, C 295.1, F 46.4. Calories and carbs are over.
const overPlate = { kcal: 1218, protein_g: 71.2, carbs_g: 166.1, fat_g: 27.4 };

const platePlaceLabel = "Today with your plate";

// No button and a label, as the add dialog shows it: leaving for Targets would drop the plate.
export const WithPlateShare: Story = {
  args: { bars: progressBars(thursday, targets, goldenPlate) },
  render: ({ bars }) => <MacroProgressStrip bars={bars} label={platePlaceLabel} />,
};

// Over target, in a dialog: the outline's gap is the sheet's surface colour and the number stays in primary text.
export const OverTargetOnSheet: Story = {
  args: { bars: progressBars(thursday, targets, overPlate) },
  render: ({ bars }) => <MacroProgressStrip bars={bars} label={platePlaceLabel} surface="sheet" />,
  decorators: [
    (Story) => (
      <div className="bg-surface-sheet">
        <Story />
      </div>
    ),
  ],
};

const cardDecorator: NonNullable<Story["decorators"]> = [
  (Story) => (
    <div className="max-w-[360px] rounded-large border border-border bg-surface p-4">
      <Story />
    </div>
  ),
];

// On a card the columns size to their numbers, four across from 1024 px, and two by two below.
export const AsCard: Story = {
  args: { bars: progressBars(thursday, targets, goldenPlate) },
  render: ({ bars }) => <MacroProgressStrip bars={bars} label={platePlaceLabel} surface="card" />,
  decorators: cardDecorator,
};

export const AsCardOnPhone: Story = {
  ...AsCard,
  globals: { viewport: { value: "mobile", isRotated: false } },
};

export const OverTargetAsCard: Story = {
  ...AsCard,
  args: { bars: progressBars(thursday, targets, overPlate) },
};

// The place of the strip while the day is read: 26 px high with four placeholder columns.
export const Loading: Story = {
  render: () => <MacroProgressStripSkeleton />,
};
