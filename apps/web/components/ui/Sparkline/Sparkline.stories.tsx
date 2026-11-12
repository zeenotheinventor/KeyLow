import { Sparkline } from "./Sparkline";

import type { Meta, StoryObj } from "@storybook/nextjs";

// A body fat series by day, with the front padded with nulls so the line is placed by date.
const BODY_FAT = [null, null, null, 23.4, 23.2, 23.3, 23.0, 22.8, 22.9, 22.6, 22.5, 22.4];

const meta = {
  title: "UI/Sparkline",
  component: Sparkline,
  decorators: [
    (Story) => (
      <div className="p-6">
        <Story />
      </div>
    ),
  ],
  args: {
    points: [40, 42.5, 42.5, 45, 47.5, 47.5, 50, 50, 52.5, 55],
    label: "Barbell row, up 15 kg",
  },
} satisfies Meta<typeof Sparkline>;

export default meta;

type Story = StoryObj<typeof meta>;

// 64 by 20 with a dot on the latest reading. The scheme comes from the theme toolbar.
export const Rising: Story = {};

export const Falling: Story = {
  args: { points: [55, 52.5, 52.5, 50, 47.5, 45, 42.5, 40], label: "Barbell row, down 15 kg" },
};

export const Flat: Story = { args: { points: [50, 50, 50, 50], label: "Barbell row, unchanged" } };

// A skipped week breaks the line, and the gap has no point. The reading with a gap either side is a smaller dot.
export const Gapped: Story = {
  args: { points: [40, 42.5, 45, null, null, 50, null, 55], label: "Barbell row, up 15 kg" },
};

// A reading with a skipped week either side has no line, so it is a dot alone.
export const ReadingAlone: Story = {
  args: { points: [null, null, 47.5, null], label: "Barbell row, one reading" },
};

export const PositiveTone: Story = { args: { tone: "positive" } };

export const NegativeTone: Story = {
  args: {
    points: [55, 52.5, 50, 47.5, 45, 40],
    tone: "negative",
    label: "Barbell row, down 15 kg",
  },
};

// A row that says it in words hides the line from a screen reader.
export const Decorative: Story = { args: { decorative: true } };

// 128 by 40 with a 4 inset, a 2 line and a dot ringed in the surface colour, as the Body composition cards draw it.
export const Wide: Story = {
  args: {
    size: "wide",
    points: BODY_FAT,
    label: "Body fat over the last 90 days, trend 22.4 %",
  },
};

export const WideFalling: Story = {
  args: {
    size: "wide",
    points: [58, 57.4, 57.6, 56.9, 56.5, 56.6, 55.8],
    label: "Weight over the last 90 days, trend 55.8 kg",
  },
};

export const WideGapped: Story = {
  args: {
    size: "wide",
    points: [23.4, 23.2, null, null, 22.9, 22.6, null, 22.4],
    label: "Body fat over the last 90 days, trend 22.4 %",
  },
};

export const WideReadingAlone: Story = {
  args: {
    size: "wide",
    points: [null, null, null, 22.4, null],
    label: "Body fat, one reading, 22.4 %",
  },
};
